//! Kafka consumer for broker events that update the search index.
//!
//! The poll loop shards each decoded event by its ordering key onto one of a
//! fixed pool of bounded, sequential workers and commits the offset
//! immediately after that handoff. Events sharing an ordering key — the
//! entity whose search documents they mutate — stay on one worker in
//! partition order; unrelated events process in parallel. An event that only
//! rereads its entity is committed without a handoff while a reread for that
//! entity is already queued, so one busy entity cannot fill its worker's
//! channel and stall every topic. Malformed records are committed without a
//! handoff so they cannot wedge a partition.
//! Processing is retried in-process; exhausted events are logged and dropped
//! because their offsets are already committed.
//!
//! Per-entity event mapping and processing live in the [`calendar_event`],
//! [`call`], [`channel`], [`chat`], [`document`], [`email`], [`project`], and
//! [`property`] submodules; this module owns the poll loop, worker, retry
//! policy, and commit semantics.

#![allow(clippy::enum_variant_names)]

mod agent_session;
mod calendar_event;
mod call;
mod channel;
mod chat;
mod context;
mod document;
mod email;
mod message;
mod project;
mod property;
#[cfg(test)]
mod test;

use std::{
    borrow::Cow,
    collections::{HashSet, hash_map::DefaultHasher},
    future::Future,
    hash::{Hash as _, Hasher as _},
    sync::{Arc, Mutex, PoisonError},
    time::Duration,
};

use ::agent_session::domain::events::AgentSessionLifecycleRoxEvent;
use ::call::domain::events::CallRoxEvent;
use ::chat::domain::events::ChatRoxEvent;
use ::email::domain::events::EmailRoxEvent;
use calendar_events::domain::events::CalendarRoxEvent;
use channels::domain::broker_events::ChannelRoxEvent;
use documents::domain::events::DocumentRoxEvent;
use kafka_util::{GroupName, InitialOffset, KafkaEventConsumer, consumer_span, record_span_error};
use rox_event_broker::{
    KafkaConsumerAdapter, RoxEvent as _, RoxEventCollection, RoxEventConsumerService,
};
use messages::outbound::broker::MessageRoxEvent;
use projects::domain::events::ProjectRoxEvent;
use properties::domain::events::PropertyRoxEvent;
use rdkafka::{
    consumer::CommitMode,
    message::{BorrowedMessage, Message as _},
};
use rootcause::prelude::{Report, ResultExt as _};
use tokio::{sync::mpsc, task::JoinHandle};
use tokio_retry::{Retry, strategy::ExponentialBackoff};
use tracing::{Instrument as _, field};
use uuid::Uuid;

use self::{
    calendar_event::process_calendar_event,
    call::{describe_call_event, process_call_event},
    channel::{describe_channel_event, process_channel_event},
    chat::{describe_chat_event, process_chat_event},
    document::{describe_document_event, process_document_event},
    email::{describe_email_event, email_ordering_key, process_email_event},
    message::{describe_message_event, process_message_event},
    project::{describe_project_event, process_project_event},
    property::{describe_property_event, process_property_event},
};

pub(crate) use self::context::KafkaProcessingContext;

/// Consumer group used for live search-index event offsets.
pub(crate) struct SearchProcessingConsumerGroup;

impl GroupName for SearchProcessingConsumerGroup {
    const GROUP_NAME: &'static str = "search-processing-service";
    // `macro.messages` joined this group's subscription with no committed
    // offset; starting at its head avoids replaying the topic's retention.
    const INITIAL_OFFSET: InitialOffset = InitialOffset::Latest;
}

type SearchProcessingKafkaAdapter =
    KafkaConsumerAdapter<SearchProcessingConsumerGroup, DeclaredRoxEvent>;
type SearchProcessingKafkaConsumer =
    RoxEventConsumerService<DeclaredRoxEvent, SearchProcessingKafkaAdapter>;

rox_event_broker::declare_topics!(
    DeclaredRoxEvent:
        AgentSessionLifecycleRoxEvent,
        CalendarRoxEvent,
        CallRoxEvent,
        ChannelRoxEvent,
        ChatRoxEvent,
        DocumentRoxEvent,
        EmailRoxEvent,
        MessageRoxEvent,
        ProjectRoxEvent,
        PropertyRoxEvent,
);

/// Number of sequential workers events are sharded across by ordering key.
///
/// Each in-flight event holds a database connection and an OpenSearch
/// request, so this also bounds the consumer's downstream concurrency.
const WORKER_COUNT: usize = 10;
/// Maximum number of decoded events waiting for each sequential worker.
///
/// Offsets are committed at handoff, so a crash can drop up to
/// `WORKER_COUNT * WORKER_CHANNEL_CAPACITY` queued events, plus the
/// agent-session events each queued reread absorbed.
const WORKER_CHANNEL_CAPACITY: usize = 16;
/// Delay before polling Kafka again after a receive error.
const RECEIVE_ERROR_RETRY_DELAY: Duration = Duration::from_secs(1);
/// Total processing attempts before an event is dropped.
const MAX_PROCESSING_ATTEMPTS: u32 = 3;
/// Delay before the first retry; each later delay doubles.
const PROCESSING_RETRY_BASE_DELAY: Duration = Duration::from_secs(1);

/// A decoded search-processing event and its Kafka coordinates.
struct ReceivedEvent {
    event: DeclaredRoxEvent,
    partition: i32,
    offset: i64,
    /// Wire type of `event`, e.g. `email.thread_backfilled`.
    event_type: &'static str,
    /// When the broker recorded the event, in Unix milliseconds, if it did.
    produced_at_ms: Option<i64>,
    /// The record's `kafka.process` span, from receipt until processing ends,
    /// so its duration includes the wait in the worker channel.
    span: tracing::Span,
}

/// Outcome of one decoded broker event, recorded as the `outcome` field of
/// its `process_event` span.
#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::IntoStaticStr)]
#[strum(serialize_all = "snake_case")]
enum EventOutcome {
    /// The corresponding search-index operation succeeded.
    Indexed,
    /// The recognized event does not require a search-index operation.
    Ignored,
    /// Processing failed after all retries and the already-committed event was dropped.
    Dropped,
    /// Committed without processing: a reread for the same entity was queued.
    Coalesced,
    /// Committed without processing: the event changes nothing indexed.
    NoIndexChange,
}

/// Result of decoding and attempting a channel handoff.
///
/// Successful handoffs, coalesced rereads, events that change nothing indexed,
/// and malformed records are safe to commit. A closed worker channel must leave the current record uncommitted so
/// supervision can restart the consumer and redeliver it.
#[derive(Debug)]
enum HandoffOutcome<E> {
    HandedOff,
    /// A reread for the same entity is already queued and has not started, so
    /// it will read state at least as new as this event.
    Coalesced,
    /// The event cannot change anything the search index holds.
    NoIndexChange,
    MalformedRecord(E),
    WorkerClosed,
}

fn processing_retry_strategy() -> impl Iterator<Item = Duration> {
    ExponentialBackoff::from_millis(2)
        .factor(500)
        .take((MAX_PROCESSING_ATTEMPTS - 1) as usize)
}

async fn retry_processing_with_strategy<I, F, Fut, E>(
    strategy: I,
    mut operation: F,
) -> Result<(), E>
where
    I: Iterator<Item = Duration>,
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<(), E>>,
{
    let mut attempt = 0;
    Retry::start(strategy, || {
        attempt += 1;
        operation(attempt)
    })
    .await
}

async fn retry_processing<F, Fut, E>(operation: F) -> Result<(), E>
where
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<(), E>>,
{
    retry_processing_with_strategy(processing_retry_strategy(), operation).await
}

/// Sharding key that serializes all events mutating the same search documents.
///
/// Every topic's producer key is already the entity its index actions target
/// (calendar-event, call, channel, chat, document, project, or property-entity
/// id), except email events, which are produced with a link-scoped key and
/// instead shard by thread so one inbox's backlog can spread across the worker
/// pool.
fn ordering_key(event: &DeclaredRoxEvent) -> Cow<'_, str> {
    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::CalendarRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::CallRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::ChannelRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::ChatRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::DocumentRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::EmailRoxEvent(event) => email_ordering_key(event),
        DeclaredRoxEvent::MessageRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::ProjectRoxEvent(event) => Cow::Borrowed(event.key()),
        DeclaredRoxEvent::PropertyRoxEvent(event) => Cow::Borrowed(event.key()),
    }
}

/// Whether processing `event` can change the search index.
fn changes_search_index(event: &DeclaredRoxEvent) -> bool {
    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => {
            agent_session::changes_search_projection(event)
        }
        DeclaredRoxEvent::CalendarRoxEvent(_)
        | DeclaredRoxEvent::CallRoxEvent(_)
        | DeclaredRoxEvent::ChannelRoxEvent(_)
        | DeclaredRoxEvent::ChatRoxEvent(_)
        | DeclaredRoxEvent::DocumentRoxEvent(_)
        | DeclaredRoxEvent::EmailRoxEvent(_)
        | DeclaredRoxEvent::MessageRoxEvent(_)
        | DeclaredRoxEvent::ProjectRoxEvent(_)
        | DeclaredRoxEvent::PropertyRoxEvent(_) => true,
    }
}

/// Key of an event whose processing only rereads its entity's current state,
/// so a queued reread already covers it.
fn coalescible_reread_key(event: &DeclaredRoxEvent) -> Option<String> {
    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => {
            Some(agent_session::reread_key(event))
        }
        DeclaredRoxEvent::CalendarRoxEvent(_)
        | DeclaredRoxEvent::CallRoxEvent(_)
        | DeclaredRoxEvent::ChannelRoxEvent(_)
        | DeclaredRoxEvent::ChatRoxEvent(_)
        | DeclaredRoxEvent::DocumentRoxEvent(_)
        | DeclaredRoxEvent::EmailRoxEvent(_)
        | DeclaredRoxEvent::MessageRoxEvent(_)
        | DeclaredRoxEvent::ProjectRoxEvent(_)
        | DeclaredRoxEvent::PropertyRoxEvent(_) => None,
    }
}

/// Entities with a coalescible reread queued on a worker but not yet started.
///
/// While one reread for an entity waits in its worker's channel, later hints
/// for that entity add nothing: the queued reread starts after them and reads
/// newer state. Skipping them keeps one busy entity from filling its worker's
/// channel, which would stop handoff for every topic and partition.
#[derive(Debug, Default)]
struct PendingRereads(Mutex<HashSet<String>>);

impl PendingRereads {
    /// Marks `key` queued; returns false when a reread for it already waits.
    fn claim(&self, key: String) -> bool {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(key)
    }

    /// Clears `key` before its reread starts, so a hint arriving during the
    /// reread queues the next one.
    fn release(&self, key: &str) {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(key);
    }
}

/// Fixed pool of sequential workers, sharded by [`ordering_key`].
///
/// Events with the same ordering key always land on the same worker's FIFO
/// channel, so they process in handoff (partition) order; events with
/// different keys may process concurrently.
struct WorkerPool {
    senders: Vec<mpsc::Sender<ReceivedEvent>>,
    pending_rereads: Arc<PendingRereads>,
}

impl WorkerPool {
    /// `pending_rereads` must be the set the workers draining `senders` release.
    fn new(
        senders: Vec<mpsc::Sender<ReceivedEvent>>,
        pending_rereads: Arc<PendingRereads>,
    ) -> Self {
        assert!(
            !senders.is_empty(),
            "worker pool requires at least one worker"
        );
        Self {
            senders,
            pending_rereads,
        }
    }

    /// Spawns [`WORKER_COUNT`] workers sharing `context` and returns their
    /// join handles alongside the pool. Dropping the pool closes every worker
    /// channel, letting the workers drain and exit.
    fn spawn(context: &KafkaProcessingContext) -> (Self, Vec<JoinHandle<()>>) {
        let pending_rereads = Arc::new(PendingRereads::default());
        let (senders, workers) = (0..WORKER_COUNT)
            .map(|_| {
                let (sender, receiver) = mpsc::channel(WORKER_CHANNEL_CAPACITY);
                (
                    sender,
                    tokio::spawn(run_event_worker(
                        context.clone(),
                        receiver,
                        Arc::clone(&pending_rereads),
                    )),
                )
            })
            .unzip();
        (Self::new(senders, pending_rereads), workers)
    }

    fn shard_index(&self, key: &str) -> usize {
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        (hasher.finish() % self.senders.len() as u64) as usize
    }

    async fn handoff<E>(&self, decoded: Result<ReceivedEvent, E>) -> HandoffOutcome<E> {
        let event = match decoded {
            Ok(event) => event,
            Err(error) => return HandoffOutcome::MalformedRecord(error),
        };
        // Before any reread claim: an event that changes nothing must not hold
        // one and absorb a later event that does.
        if !changes_search_index(&event.event) {
            record_outcome(&processing_span(&event), EventOutcome::NoIndexChange);
            return HandoffOutcome::NoIndexChange;
        }

        let shard = self.shard_index(ordering_key(&event.event).as_ref());
        let sender = &self.senders[shard];
        // A dead worker may still hold a claim for a reread it will never run;
        // leave the record uncommitted so a restart redelivers it.
        if sender.is_closed() {
            return HandoffOutcome::WorkerClosed;
        }
        let reread_key = coalescible_reread_key(&event.event);
        if let Some(key) = &reread_key
            && !self.pending_rereads.claim(key.clone())
        {
            record_outcome(&processing_span(&event), EventOutcome::Coalesced);
            return HandoffOutcome::Coalesced;
        }

        match sender.send(event).await {
            Ok(()) => HandoffOutcome::HandedOff,
            Err(_) => {
                if let Some(key) = &reread_key {
                    self.pending_rereads.release(key);
                }
                HandoffOutcome::WorkerClosed
            }
        }
    }
}

fn attach_event_coordinates<E>(
    decoded: Result<DeclaredRoxEvent, E>,
    partition: i32,
    offset: i64,
    span: tracing::Span,
) -> Result<ReceivedEvent, E> {
    decoded.map(|event| ReceivedEvent {
        event_type: event_type(&event),
        event,
        partition,
        offset,
        produced_at_ms: None,
        span,
    })
}

/// Opens a record's `kafka.process` span, decodes the record inside it, and
/// attaches the span, with the record's coordinates, to the decoded event.
/// The span is returned on its own too, so a record that failed to decode can
/// still be marked failed.
fn receive_record<M: rdkafka::Message, E>(
    message: &M,
    decode: impl FnOnce() -> Result<DeclaredRoxEvent, E>,
) -> (tracing::Span, Result<ReceivedEvent, E>) {
    let span = consumer_span(message, SearchProcessingConsumerGroup::GROUP_NAME);
    let decoded = span.in_scope(decode);
    let received =
        attach_event_coordinates(decoded, message.partition(), message.offset(), span.clone()).map(
            |received| ReceivedEvent {
                produced_at_ms: message.timestamp().to_millis(),
                ..received
            },
        );
    if let Ok(received) = &received {
        record_event_identity(&span, received);
    }
    (span, received)
}

/// The search entity an event acts on, safe to record: every producer key
/// except entity properties', which can name a user.
fn entity_id(event: &DeclaredRoxEvent) -> Option<Cow<'_, str>> {
    match event {
        DeclaredRoxEvent::PropertyRoxEvent(_) => None,
        _ => Some(ordering_key(event)),
    }
}

/// The event's wire type, e.g. `email.thread_backfilled`.
fn event_type(event: &DeclaredRoxEvent) -> &'static str {
    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => event.event().event.name(),
        DeclaredRoxEvent::CalendarRoxEvent(event) => {
            calendar_event::index_action(&event.event().event).1
        }
        DeclaredRoxEvent::CallRoxEvent(event) => {
            describe_call_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::ChannelRoxEvent(event) => {
            describe_channel_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::ChatRoxEvent(event) => {
            describe_chat_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::DocumentRoxEvent(event) => {
            describe_document_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::EmailRoxEvent(event) => {
            describe_email_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::MessageRoxEvent(event) => {
            describe_message_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::ProjectRoxEvent(event) => {
            describe_project_event(&event.event().event).event_type
        }
        DeclaredRoxEvent::PropertyRoxEvent(event) => {
            describe_property_event(&event.event().event).event_type
        }
    }
}

fn event_id(event: &DeclaredRoxEvent) -> Uuid {
    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::CalendarRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::CallRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::ChannelRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::ChatRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::DocumentRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::EmailRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::MessageRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::ProjectRoxEvent(event) => event.event().event_id,
        DeclaredRoxEvent::PropertyRoxEvent(event) => event.event().event_id,
    }
}

/// Records which event a record's `kafka.process` span carries.
fn record_event_identity(span: &tracing::Span, received: &ReceivedEvent) {
    span.record("macro.event.id", field::display(event_id(&received.event)));
    span.record("macro.event.type", received.event_type);
    if let DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) = &received.event {
        span.record(
            "agent.session.id",
            field::display(event.event().event.session_id()),
        );
    }
}

/// The `process_event` span for one record: the processing phase under its
/// `kafka.process` span. `record_age_ms` is how long after the broker recorded
/// the event processing began, the search index's lag for that entity.
fn processing_span(received: &ReceivedEvent) -> tracing::Span {
    let record_age_ms = received
        .produced_at_ms
        .map(|produced_at| chrono::Utc::now().timestamp_millis() - produced_at);
    tracing::info_span!(
        parent: &received.span,
        "process_event",
        partition = received.partition,
        offset = received.offset,
        event_type = received.event_type,
        entity_id = entity_id(&received.event).as_deref(),
        record_age_ms,
        outcome = field::Empty,
        otel.status_code = field::Empty,
    )
}

fn record_outcome(span: &tracing::Span, outcome: EventOutcome) {
    span.record("outcome", <&'static str>::from(outcome));
    if outcome == EventOutcome::Dropped {
        span.record("otel.status_code", "ERROR");
    }
}

/// Runs one record's processing inside its spans and records the outcome. A
/// dropped event also fails the record's span, the consumer's top-level span,
/// so drops count in the service's error rate.
async fn process_received<'a, F, Fut>(received: &'a ReceivedEvent, process: F)
where
    F: FnOnce(&'a ReceivedEvent) -> Fut,
    Fut: Future<Output = EventOutcome>,
{
    let span = processing_span(received);
    // A span ends at its last exit, so the record's span is entered again
    // here to cover the processing it waited for.
    let outcome = process(received)
        .instrument(span.clone())
        .instrument(received.span.clone())
        .await;
    record_outcome(&span, outcome);
    if outcome == EventOutcome::Dropped {
        record_span_error(&received.span, "event dropped after its processing retries");
    }
}

async fn process_event(
    context: &KafkaProcessingContext,
    event: &DeclaredRoxEvent,
    partition: i32,
    offset: i64,
) -> EventOutcome {
    let db = &context.db;
    let opensearch_client = context.opensearch_client.as_ref();

    match event {
        DeclaredRoxEvent::AgentSessionLifecycleRoxEvent(event) => {
            agent_session::process_agent_session_event(context, event).await
        }
        DeclaredRoxEvent::CallRoxEvent(event) => {
            process_call_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::CalendarRoxEvent(event) => {
            if !context.calendar_search_enabled {
                // The offset is committed either way, so a change that arrives
                // while the flag is off is not replayed when it flips — the
                // backfill endpoint is how an enabled environment catches up.
                tracing::debug!(
                    partition,
                    offset,
                    "calendar search is disabled; skipping calendar event"
                );
                return EventOutcome::Ignored;
            }
            process_calendar_event(context, event, partition, offset).await
        }
        DeclaredRoxEvent::ChannelRoxEvent(event) => {
            process_channel_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::ChatRoxEvent(event) => {
            process_chat_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::DocumentRoxEvent(event) => {
            process_document_event(context, event, partition, offset).await
        }
        DeclaredRoxEvent::MessageRoxEvent(event) => {
            process_message_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::EmailRoxEvent(event) => {
            process_email_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::ProjectRoxEvent(event) => {
            process_project_event(db, opensearch_client, event, partition, offset).await
        }
        DeclaredRoxEvent::PropertyRoxEvent(event) => {
            process_property_event(db, opensearch_client, event, partition, offset).await
        }
    }
}

async fn run_event_worker(
    context: KafkaProcessingContext,
    events: mpsc::Receiver<ReceivedEvent>,
    pending_rereads: Arc<PendingRereads>,
) {
    let context = &context;
    drain_worker_events(events, pending_rereads, |received| async move {
        process_received(&received, |received| {
            process_event(
                context,
                &received.event,
                received.partition,
                received.offset,
            )
        })
        .await;
    })
    .await;
    tracing::trace!("search processing event worker drained");
}

/// Processes one worker's events in order until its channel closes.
///
/// A reread's claim is released as it is dequeued, before `process` reads
/// anything, so an event that arrives mid-reread queues the next one.
async fn drain_worker_events<F, Fut>(
    mut events: mpsc::Receiver<ReceivedEvent>,
    pending_rereads: Arc<PendingRereads>,
    mut process: F,
) where
    F: FnMut(ReceivedEvent) -> Fut,
    Fut: Future<Output = ()>,
{
    while let Some(received) = events.recv().await {
        if let Some(key) = coalescible_reread_key(&received.event) {
            pending_rereads.release(&key);
        }
        process(received).await;
    }
}

fn commit_logged(consumer: &SearchProcessingKafkaConsumer, message: &BorrowedMessage<'_>) {
    match consumer.inner().commit_message(message, CommitMode::Async) {
        Ok(()) => tracing::trace!(
            topic = rdkafka::Message::topic(message),
            partition = message.partition(),
            offset = message.offset(),
            "committed search processing event offset"
        ),
        Err(error) => tracing::error!(
            error = ?error,
            topic = rdkafka::Message::topic(message),
            partition = message.partition(),
            offset = message.offset(),
            "failed to commit search processing event offset"
        ),
    }
}

async fn poll_events(
    consumer: &SearchProcessingKafkaConsumer,
    workers: WorkerPool,
    shutdown: impl Future<Output = ()> + Send,
) -> Result<(), Report> {
    let mut shutdown = std::pin::pin!(shutdown);
    loop {
        tokio::select! {
            _ = &mut shutdown => {
                tracing::info!("search processing event consumer shutting down");
                break;
            }
            result = consumer.recv() => {
                let message = match result {
                    Ok(message) => message,
                    Err(_) => { // error is logged in tracing automatically
                        tokio::time::sleep(RECEIVE_ERROR_RETRY_DELAY).await;
                        continue;
                    }
                };
                let kafka_message = message.inner();
                let (span, decoded) = receive_record(kafka_message, || message.decode_payload());

                match workers.handoff(decoded).instrument(span.clone()).await {
                    HandoffOutcome::HandedOff
                    | HandoffOutcome::Coalesced
                    | HandoffOutcome::NoIndexChange => {}
                    HandoffOutcome::MalformedRecord(error) => {
                        record_span_error(&span, &error);
                        tracing::error!(
                            parent: &span,
                            error = %error,
                            topic = rdkafka::Message::topic(kafka_message),
                            partition = kafka_message.partition(),
                            offset = kafka_message.offset(),
                            "dropping undecodable search processing event"
                        );
                    }
                    HandoffOutcome::WorkerClosed => {
                        record_span_error(&span, "worker channel closed before handoff");
                        tracing::error!(
                            parent: &span,
                            topic = rdkafka::Message::topic(kafka_message),
                            partition = kafka_message.partition(),
                            offset = kafka_message.offset(),
                            "search processing event worker channel closed; leaving offset uncommitted"
                        );
                        return Err(rootcause::report!(
                            "search processing event worker channel closed for topic {} at partition {} offset {}",
                            rdkafka::Message::topic(kafka_message),
                            kafka_message.partition(),
                            kafka_message.offset(),
                        ));
                    }
                }

                // Deliberately commit immediately after a successful handoff. The worker
                // owns retries and drops exhausted events without requesting redelivery.
                span.in_scope(|| commit_logged(consumer, kafka_message));
            }
        }
    }

    Ok(())
}

/// Runs the bounded broker event poll loop and worker pool until `shutdown`
/// resolves.
///
/// The caller is responsible for supervising this function. A closed worker
/// channel returns an error without committing the current Kafka message. On
/// normal shutdown the senders are dropped and all buffered events are
/// processed before this function returns.
#[tracing::instrument(skip(context, shutdown), fields(brokers), err)]
pub(crate) async fn run_event_consumer(
    brokers: &str,
    context: KafkaProcessingContext,
    shutdown: impl Future<Output = ()> + Send,
) -> Result<(), Report> {
    let consumer = KafkaEventConsumer::<SearchProcessingConsumerGroup>::from_env(brokers)?;
    let consumer = KafkaConsumerAdapter::<SearchProcessingConsumerGroup, ()>::new(consumer)
        .subscribe::<DeclaredRoxEvent>()
        .context("failed to subscribe to search processing event topics")?;
    let consumer = SearchProcessingKafkaConsumer::new(consumer);
    tracing::info!(
        topics = ?DeclaredRoxEvent::topics(),
        group = SearchProcessingConsumerGroup::GROUP_NAME,
        "search processing event consumer listening"
    );

    let (pool, workers) = WorkerPool::spawn(&context);
    // Passing the pool by value drops every sender when polling stops, which
    // closes the worker channels so the workers drain and exit.
    let poll_result = poll_events(&consumer, pool, shutdown).await;

    let mut worker_failure = None;
    for worker in workers {
        if let Err(error) = worker.await {
            worker_failure = Some(error);
        }
    }

    poll_result?;
    if let Some(error) = worker_failure {
        Err(rootcause::report!(error))?;
    }
    Ok(())
}
