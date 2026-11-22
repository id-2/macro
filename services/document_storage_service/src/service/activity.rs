//! Composition root for the activity consumer.
//!
//! DSS is the one place that legitimately knows every domain, so it declares
//! which topics feed activity and dispatches each decoded event to the
//! owning domain's mapping. All semantics live in the domain crates; all
//! machinery lives in the `activity` crate. These arms are pure wiring.

use activity::Ingest;
use agent_session::domain::events::AgentSessionLifecycleRoxEvent;
use call::domain::events::CallRoxEvent;
use channels::domain::broker_events::ChannelRoxEvent;
use chat::domain::events::ChatRoxEvent;
use databases::domain::events::DatabaseRoxEvent;
use documents_hex::domain::events::DocumentRoxEvent;
use email::domain::events::EmailRoxEvent;
use forms::domain::events::FormRoxEvent;
use initiative::domain::events::InitiativeRoxEvent;
use rox_event_broker::RoxEvent as _;
use messages::outbound::broker::MessageRoxEvent;
use projects_hex::domain::events::ProjectRoxEvent;
use properties::domain::events::PropertyRoxEvent;

#[allow(clippy::enum_variant_names)]
mod source {
    use super::*;

    rox_event_broker::declare_topics!(
        ActivitySourceEvent:
            DocumentRoxEvent,
            ChannelRoxEvent,
            MessageRoxEvent,
            ChatRoxEvent,
            ProjectRoxEvent,
            EmailRoxEvent,
            PropertyRoxEvent,
            CallRoxEvent,
            InitiativeRoxEvent,
            DatabaseRoxEvent,
            FormRoxEvent,
            AgentSessionLifecycleRoxEvent,
    );
}
pub(crate) use source::ActivitySourceEvent;

mod timeline;
pub(crate) use timeline::TimelinePublisher;

/// Dispatches each event to its owning domain. Document editing sessions use
/// the shared inactivity store; all classification and debounce policy stays
/// in the documents domain.
pub(crate) async fn ingest(
    event: ActivitySourceEvent,
    editing_activity: &impl documents_hex::domain::ports::EditingActivityStore,
) -> Ingest {
    fn arm<E: activity::ActivitySource>(envelope: &rox_event_broker::Event<E>) -> Ingest {
        envelope.event.ingest(envelope.event_id)
    }

    let correlation = event.agent_correlation_id();
    agent_correlation::context::scope(correlation, async {
        match event {
            ActivitySourceEvent::DocumentRoxEvent(e) => {
                let envelope = e.event();
                documents_hex::domain::activity::ingest_with_editing_sessions(
                    &envelope.event,
                    envelope.event_id,
                    editing_activity,
                )
                .await
            }
            ActivitySourceEvent::ChannelRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::MessageRoxEvent(e) => {
                let envelope = e.event();
                channels::domain::activity::ingest_message_event(envelope.event_id, &envelope.event)
            }
            ActivitySourceEvent::ChatRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::ProjectRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::EmailRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::PropertyRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::CallRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::InitiativeRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::DatabaseRoxEvent(e) => arm(e.event()),
            ActivitySourceEvent::FormRoxEvent(event) => arm(event.event()),
            ActivitySourceEvent::AgentSessionLifecycleRoxEvent(event) => arm(event.event()),
        }
    })
    .await
}

pub(crate) use activity::outbound::entity_access_audience::EntityAccessActivityAudience;
