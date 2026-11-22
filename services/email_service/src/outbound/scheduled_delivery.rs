//! PostgreSQL and provider adapters for scheduled email delivery.
use crate::outbound::email_api::GmailApi;
use crate::util::gmail::send::{
    attachment_snapshot::prepare_delivery_attachments, cleanup_draft_attachments,
    generate_email_threading_headers,
};
use anyhow::Context;
use chrono::Utc;
use email::domain::events::{
    EmailEventOrigin, EmailMacroEvent, MessageDeletedMetadata, MessageSentMetadata,
};
use email::domain::scheduled_delivery::state::{self as delivery, DeliveryClaim};
use email::domain::scheduled_delivery::{
    ClaimedDelivery, DELIVERY_LEASE_SECONDS, DeliveryMode, DeliveryPause,
    PREPARATION_RETRY_SECONDS, PreparationError, RECONCILIATION_DELAY_SECONDS,
    ScheduledDeliveryRepo, ScheduledMessageSender, SenderMissing, SubmissionError,
    attachments::{ApprovedAttachments, AttachmentSnapshotMismatch},
};
use email::domain::send_attempt::{PreparedSendContentUnavailable, SendSnapshot};
use email_api_client::domain::models::{EmailApiError, PreparedSendMessage, SendRequest, SentIds};
use lettre::address::{Address, Envelope};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Tokio1Executor};
use models_email::service::link::UserProvider;
use models_email::service::{attachment::AttachmentDraft, link::Link, message::MessageToSend};
use rox_event_broker::{KafkaEventPublisher, RoxEventBroker, RoxEventBrokerService};
use rox_user_id::cowlike::CowLike as _;
use rox_user_id::user_id::RoxUserIdStr;
use std::time::{Duration, Instant};
use tokio_util::task::TaskTracker;
use uuid::Uuid;

use email::domain::scheduled_delivery::identity::process_sent_message;

mod content;

rox_env_var::maybe_env_vars! {
    struct SmtpHost;
    struct SmtpPort;
    struct SmtpUsername;
    struct SmtpPassword;
    struct SmtpFrom;
    struct SmtpTls;
}

/// Concrete worker adapters, wired by the scheduled worker's composition root.
pub struct ScheduledDeliveryAdapter {
    pub db: sqlx::PgPool,
    pub forwarded_attachments: email::domain::forwarded_attachments::ForwardedAttachmentService<
        crate::outbound::forwarded_attachments::PgForwardedAttachmentRepo,
    >,
    pub email_api: GmailApi,
    pub attachment_bytes:
        std::sync::Arc<dyn email::domain::attachment_access::AuthorizedAttachmentBytes>,
    pub s3_client: s3_client::S3,
    pub attachment_bucket: String,
    pub rox_event_broker: RoxEventBrokerService<KafkaEventPublisher, TaskTracker>,
    pub read_receipts: email::domain::read_receipts::ReadReceiptService<
        email::outbound::read_receipts_pg::ReadReceiptPgRepository,
    >,
}

/// Context obtained only by winning an atomic database claim.
pub struct ScheduledClaim {
    link: Link,
    delivery: DeliveryClaim,
    /// Transport chosen from the mailbox's own provider value.
    provider: DeliveryProvider,
}

/// Provider result and attachment cleanup data retained until DB completion.
pub struct SentDelivery {
    message: MessageToSend,
    attachments: Option<Vec<AttachmentDraft>>,
}

/// Transport that carries a prepared delivery out of the service.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DeliveryProvider {
    /// Gmail HTTP API through the shared email API client.
    Gmail,
    /// The account's first-party Rox mailbox through the SMTP relay.
    Rox,
}

impl DeliveryProvider {
    /// Select by provider value, never by mailbox identity. Outlook keeps its
    /// durable draft coordinator and is never claimed by this adapter.
    fn for_link(provider: UserProvider) -> Option<Self> {
        match provider {
            UserProvider::Gmail => Some(Self::Gmail),
            UserProvider::Rox => Some(Self::Rox),
            UserProvider::Outlook => None,
        }
    }
}

impl ScheduledDeliveryRepo for ScheduledDeliveryAdapter {
    type Claim = ScheduledClaim;
    type Sent = SentDelivery;

    #[tracing::instrument(skip(self), err)]
    async fn reconcile_deletion(&self, link_id: Uuid, message_id: Uuid) -> anyhow::Result<()> {
        let Some(link) = email_db_client::links::get::fetch_link_by_id(&self.db, link_id).await?
        else {
            return Ok(());
        };
        if let Some(deleted) =
            email::domain::scheduled_delivery::deletion::reconcile_deferred_deletion(
                &self.db, link_id, message_id,
            )
            .await?
        {
            let _ = self.rox_event_broker.send_event(&EmailMacroEvent::message_deleted(MessageDeletedMetadata {
                link_id,
                owner: link.rox_id,
                message_id,
                provider_message_id: deleted.provider_id,
                thread_id: deleted.thread_id,
            })).inspect_err(|error| tracing::error!(error=?error, "failed to publish deferred email deletion"));
        }
        Ok(())
    }

    async fn try_claim(
        &self,
        link_id: Uuid,
        message_id: Uuid,
    ) -> anyhow::Result<Option<ClaimedDelivery<ScheduledClaim>>> {
        let Some(link) = email_db_client::links::get::fetch_link_by_id(&self.db, link_id).await?
        else {
            return Ok(None);
        };
        // Outlook delivery is claimed by its durable draft coordinator. This
        // legacy adapter must never claim it or release an uncertain send.
        let Some(provider) = DeliveryProvider::for_link(link.provider) else {
            return Ok(None);
        };
        Ok(
            delivery::claim_delivery(&self.db, link_id, message_id, DELIVERY_LEASE_SECONDS)
                .await?
                .map(|delivery| {
                    tracing::info!(event = "email_send.claim_acquired", %link_id, %message_id,
                        claim_id = %delivery.token.0,
                        reconcile = delivery.requires_reconciliation,
                        provider = ?provider,
                        send_lateness_ms = (Utc::now() - delivery.schedule.send_time).num_milliseconds().max(0),
                        "email delivery claim acquired");
                    ClaimedDelivery {
                        mode: if delivery.requires_reconciliation {
                            DeliveryMode::Reconcile
                        } else {
                            DeliveryMode::Send
                        },
                        claim: ScheduledClaim {
                            link,
                            delivery,
                            provider,
                        },
                    }
                }),
        )
    }

    async fn begin_send(&self, claim: &ScheduledClaim) -> anyhow::Result<bool> {
        delivery::begin_submission(&self.db, &claim.delivery, DELIVERY_LEASE_SECONDS).await
    }

    async fn release(&self, claim: &ScheduledClaim) -> anyhow::Result<()> {
        delivery::release_preparation(&self.db, &claim.delivery, PREPARATION_RETRY_SECONDS).await
    }

    async fn pause(&self, claim: &ScheduledClaim, reason: DeliveryPause) -> anyhow::Result<()> {
        delivery::pause_delivery(
            &self.db,
            &claim.delivery,
            reason == DeliveryPause::Unconfirmed,
            RECONCILIATION_DELAY_SECONDS,
        )
        .await
    }

    #[tracing::instrument(skip_all, fields(
        link_id = %claim.link.id,
        message_id = %claim.delivery.schedule.message_id,
        claim_id = %claim.delivery.token.0,
    ), err)]
    async fn complete(&self, claim: &ScheduledClaim, sent: SentDelivery) -> anyhow::Result<()> {
        let started = Instant::now();
        let ctx = self;
        let link = &claim.link;
        let data = &claim.delivery.schedule;
        let scheduled_message = &claim.delivery.schedule;
        let mut message_to_send = sent.message;
        let db_attachments = sent.attachments;
        let mut tx = ctx
            .db
            .begin()
            .await
            .context("Failed to begin transaction")?;

        email_db_client::threads::provider_identity::lock_provider_thread(
            tx.as_mut(),
            link.id,
            message_to_send
                .provider_thread_id
                .as_deref()
                .context("provider accepted send without a thread ID")?,
        )
        .await?;
        if !delivery::complete_delivery(tx.as_mut(), &claim.delivery).await? {
            tracing::info!(
                event = "email_send.completion_fenced",
                "stale claim cannot persist email completion"
            );
            return Ok(());
        }
        let result = process_sent_message(tx.as_mut(), &mut message_to_send).await;

        match result {
            Ok(_) => {
                tx.commit().await.context("Failed to commit transaction")?;
                tracing::info!(
                    event = "email_send.database_committed",
                    duration_ms = started.elapsed().as_millis() as u64,
                    delivery_lateness_ms = (Utc::now() - data.send_time).num_milliseconds().max(0),
                    "email delivery completion committed"
                );

                // The provider accepted the send and the DB updates are
                // committed: publish the message_sent event resolving the
                // earlier message_send_queued. The actor was persisted on the
                // scheduled row at enqueue time; rows from before actor
                // tracking decode to `None` (no attribution).
                let actor = scheduled_message
                    .actor_id
                    .as_deref()
                    .and_then(|raw| RoxUserIdStr::parse_from_str(raw).ok())
                    .map(|actor| actor.into_owned());
                if let (Some(message_db_id), Some(thread_db_id)) =
                    (message_to_send.db_id, message_to_send.thread_db_id)
                {
                    agent_correlation::context::scope(
                        scheduled_message.agent_correlation_id,
                        async {
                            let _ = ctx
                        .rox_event_broker
                        .send_event(&EmailMacroEvent::message_sent(MessageSentMetadata {
                            link_id: link.id,
                            owner: link.rox_id.clone(),
                            actor,
                            message_id: message_db_id,
                            thread_id: thread_db_id,
                            provider_message_id: message_to_send
                                .provider_id
                                .clone()
                                .unwrap_or_default(),
                            provider_thread_id: message_to_send
                                .provider_thread_id
                                .clone()
                                .unwrap_or_default(),
                            subject: Some(message_to_send.subject.clone()),
                            to_emails: message_to_send
                                .to
                                .iter()
                                .flatten()
                                .map(|c| c.email.clone())
                                .collect(),
                            cc_emails: message_to_send
                                .cc
                                .iter()
                                .flatten()
                                .map(|c| c.email.clone())
                                .collect(),
                            origin: EmailEventOrigin::UserAction,
                            sent_at: Utc::now(),
                        }))
                        .inspect_err(
                            |error| tracing::error!(error=?error, "failed to publish email event"),
                        );
                        },
                    )
                    .await;
                }

                // Cleanup attachments in the background after successful send
                if let (Some(draft_id), Some(attachments)) = (message_to_send.db_id, db_attachments)
                {
                    let db = ctx.db.clone();
                    let link_id = link.id;
                    tokio::spawn(async move {
                        cleanup_draft_attachments(db, link_id, draft_id, attachments).await;
                    });
                }
            }
            Err(e) => {
                if let Err(rollback_err) = tx.rollback().await {
                    tracing::error!(
                        error = ?rollback_err,
                        link_id = ?data.link_id,
                        message_id = ?data.message_id,
                        "Failed to rollback transaction after marking messages as sent failure"
                    );
                }
                return Err(e);
            }
        }

        Ok(())
    }
}

/// Fully prepared MIME and persistence data; contains no provider side effects.
pub struct PreparedDelivery {
    provider: PreparedSend,
    delivery: SentDelivery,
}

/// MIME already owned by the transport that will submit it.
enum PreparedSend {
    /// Opaque Gmail request holding its own admission permit and token.
    Gmail(PreparedSendMessage),
    /// Rox mailbox envelope; the relay is contacted only at submission.
    Rox(RoxSmtpDelivery),
}

/// RFC 5322 MIME, relay and envelope for one Rox mailbox delivery.
struct RoxSmtpDelivery {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    mime: Vec<u8>,
    envelope: Envelope,
    /// Stable Message-ID persisted as the provider message identity.
    message_id: String,
    /// Thread identity persisted for the sent message.
    thread_id: String,
}

impl ScheduledMessageSender<ScheduledClaim, SentDelivery> for ScheduledDeliveryAdapter {
    type Prepared = PreparedDelivery;

    async fn prepare(&self, claim: &ScheduledClaim) -> Result<PreparedDelivery, PreparationError> {
        self.prepare_delivery(claim)
            .await
            .map_err(classify_preparation_error)
    }

    async fn send_prepared(
        &self,
        _: &ScheduledClaim,
        mut prepared: PreparedDelivery,
    ) -> Result<SentDelivery, SubmissionError> {
        let ids = match prepared.provider {
            PreparedSend::Gmail(provider) => self
                .email_api
                .send_prepared(provider)
                .await
                .map_err(classify_submission_error)?,
            PreparedSend::Rox(rox) => submit_rox_smtp(&rox).await?,
        };
        apply_sent_ids(&mut prepared.delivery.message, ids);
        Ok(prepared.delivery)
    }

    async fn reconcile(&self, claim: &ScheduledClaim) -> anyhow::Result<Option<SentDelivery>> {
        if claim.provider != DeliveryProvider::Gmail {
            // An SMTP relay offers no sent-message search, so a Rox submission
            // cannot be confirmed after the fact. Report it as not found: the
            // domain then keeps it unconfirmed instead of ever resending.
            tracing::info!(
                event = "email_send.reconciliation",
                outcome = "unsupported",
                link_id = %claim.link.id,
                message_id = %claim.delivery.schedule.message_id,
                "SMTP relay exposes no sent-message search"
            );
            return Ok(None);
        }
        let Some(header) = claim.delivery.message_id_header.as_deref() else {
            return Ok(None);
        };
        let Some(ids) = self
            .email_api
            .find_sent_message(claim.link.id, header)
            .await?
        else {
            return Ok(None);
        };
        let (mut message, _) = email_db_client::messages::get::get_message_to_send(
            &self.db,
            claim.delivery.schedule.message_id,
            claim.link.id,
        )
        .await?;
        apply_sent_ids(&mut message, ids);
        // Reconciliation loads cleanup metadata only, never attachment bytes.
        let attachments = email_db_client::attachments::draft::fetch_draft_attachments_by_draft_id(
            &self.db,
            claim.link.id,
            claim.delivery.schedule.message_id,
        )
        .await?;
        Ok(Some(SentDelivery {
            message,
            attachments: Some(attachments),
        }))
    }
}

impl ScheduledDeliveryAdapter {
    #[tracing::instrument(skip_all, fields(
        link_id = %claim.link.id, message_id = %claim.delivery.schedule.message_id,
        claim_id = %claim.delivery.token.0, phase = "load_content",
    ), err)]
    async fn prepare_delivery(&self, claim: &ScheduledClaim) -> anyhow::Result<PreparedDelivery> {
        let data = &claim.delivery.schedule;
        // A Rox mailbox has no provider API: its sender and relay come from the
        // service environment. Resolve them before loading any content so a
        // provider without a sender leaves its queued message untouched.
        let rox_sender = match claim.provider {
            DeliveryProvider::Gmail => None,
            DeliveryProvider::Rox => Some(
                RoxSmtpSettings::from_env(claim.link.email_address.0.as_ref())
                    .ok_or(SenderMissing)?,
            ),
        };
        let (mut message, sender_contact) =
            content::load_delivery_content(&self.db, &claim.delivery)
                .await
                .context("failed to load scheduled message")?;
        let (parent_message_id, references) =
            generate_email_threading_headers(&self.db, message.replying_to_id).await;
        let approved = claim
            .delivery
            .approved_snapshot
            .as_ref()
            .map(|snapshot| serde_json::from_value::<SendSnapshot>(snapshot.clone()))
            .transpose()?
            .as_ref()
            .map(ApprovedAttachments::from)
            .unwrap_or(serde_json::from_value(
                claim.delivery.approved_attachments.clone(),
            )?);
        tracing::Span::current().record("phase", "attachments");
        let started = Instant::now();
        let actor = data
            .actor_id
            .as_deref()
            .and_then(|actor| RoxUserIdStr::parse_from_str(actor).ok());
        self.forwarded_attachments
            .for_delivery(actor.as_ref(), claim.link.id, data.message_id)
            .await?;
        let attachments = prepare_delivery_attachments(
            &self.db,
            &self.s3_client,
            self.attachment_bytes.as_ref(),
            data.actor_id
                .as_deref()
                .unwrap_or_else(|| claim.link.rox_id.as_ref()),
            &self.attachment_bucket,
            &mut message,
            Some(&approved),
        )
        .await?;
        tracing::info!(
            event = "email_send.attachments_prepared",
            duration_ms = started.elapsed().as_millis() as u64,
            "approved email attachments prepared"
        );
        // Only the provider copy carries the pixel; sync brings it back later.
        let mut outgoing = message.clone();
        outgoing.body_html = self
            .read_receipts
            .tracked_html(
                claim.link.id,
                data.message_id,
                outgoing.body_html.as_deref(),
            )
            .await;
        tracing::Span::current().record("phase", "mime_and_credentials");
        let started = Instant::now();
        let request = SendRequest {
            message: outgoing,
            from: sender_contact,
            parent_message_id,
            references,
            message_id: claim.delivery.message_id_header.clone(),
        };
        let provider = match claim.provider {
            // Gmail keeps the shared client: its admission permit, token and
            // MIME are built there exactly as before.
            DeliveryProvider::Gmail => {
                let prepared = self
                    .email_api
                    .prepare_send(
                        claim.link.id,
                        &request,
                        message.provider_thread_id.as_deref(),
                    )
                    .await?;
                PreparedSend::Gmail(prepared)
            }
            DeliveryProvider::Rox => {
                let settings = rox_sender.as_ref().ok_or(SenderMissing)?;
                PreparedSend::Rox(rox_smtp_delivery(
                    settings,
                    &request,
                    message.provider_thread_id.as_deref(),
                )?)
            }
        };
        tracing::info!(
            event = "email_send.mime_prepared",
            duration_ms = started.elapsed().as_millis() as u64,
            "email MIME and provider credentials prepared"
        );
        // The opaque provider request owns MIME, so raw attachment buffers need
        // not be retained while the provider call is in flight.
        message.attachments = None;
        Ok(PreparedDelivery {
            provider,
            delivery: SentDelivery {
                message,
                attachments,
            },
        })
    }
}

/// SMTP relay and sending identity for first-party Rox mailboxes.
///
/// The relay values are the same `SMTP_*` variables the rest of the service
/// environment already carries. `SMTP_FROM` may name the envelope sender; a
/// Rox mailbox otherwise sends as its own address.
struct RoxSmtpSettings {
    host: String,
    port: u16,
    security: SmtpSecurity,
    username: Option<String>,
    password: Option<String>,
    from: String,
}

impl RoxSmtpSettings {
    /// Read the relay from the environment for one mailbox. `None` means the
    /// provider has no sending identity here, so its queued messages must not
    /// be sent and must not be acknowledged either.
    fn from_env(mailbox: &str) -> Option<Self> {
        let host = SmtpHost::new()
            .and_then(|value| value.value().map(str::to_string))
            .filter(|host| !host.is_empty())?;
        let from = SmtpFrom::new()
            .and_then(|value| value.value().map(str::to_string))
            .map(|from| from.trim().to_string())
            .filter(|from| !from.is_empty())
            .unwrap_or_else(|| mailbox.trim().to_string());
        if from.is_empty() {
            return None;
        }
        let port = SmtpPort::new()
            .and_then(|value| value.value().and_then(|port| port.trim().parse().ok()))
            .unwrap_or(587);
        let security = SmtpSecurity::from_env_value(
            SmtpTls::new().and_then(|value| value.value().map(str::to_string)).as_deref(),
        );
        Some(Self {
            host,
            port,
            security,
            username: SmtpUsername::new()
                .and_then(|value| value.value().map(str::to_string))
                .filter(|username| !username.is_empty()),
            password: SmtpPassword::new()
                .and_then(|value| value.value().map(str::to_string))
                .filter(|password| !password.is_empty()),
            from,
        })
    }

    /// Build the relay during preparation so a broken configuration fails
    /// before the submission boundary instead of after it.
    fn mailer(&self) -> anyhow::Result<AsyncSmtpTransport<Tokio1Executor>> {
        let builder = match self.security {
            SmtpSecurity::None => {
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(self.host.as_str())
            }
            SmtpSecurity::StartTls => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(self.host.as_str())?
            }
            SmtpSecurity::Ssl => {
                AsyncSmtpTransport::<Tokio1Executor>::relay(self.host.as_str())?
            }
        };
        let builder = builder.port(self.port).timeout(Some(Duration::from_secs(30)));
        let builder = match (&self.username, &self.password) {
            (Some(username), Some(password)) => {
                builder.credentials(Credentials::new(username.clone(), password.clone()))
            }
            _ => builder,
        };
        Ok(builder.build())
    }
}

/// Wire security for the SMTP hop, chosen by `SMTP_TLS`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SmtpSecurity {
    /// Plaintext, no TLS (a local Mailpit sink).
    None,
    /// Upgrade with STARTTLS on the submission port.
    StartTls,
    /// Implicit TLS from the first byte.
    Ssl,
}

impl SmtpSecurity {
    /// Parse `SMTP_TLS` with the spellings the rest of the workspace accepts;
    /// an unset or unrecognised value keeps plaintext.
    fn from_env_value(value: Option<&str>) -> Self {
        match value.map(|value| value.trim().to_ascii_lowercase()).as_deref() {
            Some("starttls") => Self::StartTls,
            Some("ssl") | Some("smtps") | Some("tls") => Self::Ssl,
            _ => Self::None,
        }
    }
}

/// Build the Rox MIME and SMTP envelope without contacting the relay.
fn rox_smtp_delivery(
    settings: &RoxSmtpSettings,
    request: &SendRequest,
    provider_thread_id: Option<&str>,
) -> anyhow::Result<RoxSmtpDelivery> {
    // A relay cannot be searched for a sent message, so the stable Message-ID
    // is the only delivery receipt a Rox mailbox can persist. A row without one
    // needs review rather than an endless retry.
    let Some(message_id) = request.message_id.clone() else {
        return Err(anyhow::Error::new(EmailApiError::Permanent {
            message: "rox delivery requires a stable Message-ID".to_string(),
        }));
    };
    let mut recipients = Vec::new();
    for contacts in [
        &request.message.to,
        &request.message.cc,
        &request.message.bcc,
    ] {
        for contact in contacts.iter().flatten() {
            let address = contact.email.parse::<Address>().map_err(|_| {
                EmailApiError::Permanent {
                    message: "rox delivery has an invalid recipient address".to_string(),
                }
            })?;
            recipients.push(address);
        }
    }
    let from = settings.from.parse::<Address>().map_err(|_| {
        EmailApiError::Permanent {
            message: "SMTP_FROM is not a valid address".to_string(),
        }
    })?;
    let envelope = Envelope::new(Some(from), recipients).map_err(|_| {
        EmailApiError::Permanent {
            message: "rox delivery has no recipient address".to_string(),
        }
    })?;
    Ok(RoxSmtpDelivery {
        mailer: settings.mailer()?,
        mime: request.build_mime()?,
        envelope,
        thread_id: provider_thread_id
            .filter(|thread| !thread.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| message_id.clone()),
        message_id,
    })
}

/// Submit the already-built MIME exactly once.
async fn submit_rox_smtp(prepared: &RoxSmtpDelivery) -> Result<SentIds, SubmissionError> {
    prepared
        .mailer
        .send_raw(&prepared.envelope, &prepared.mime)
        .await
        .map_err(|error| classify_smtp_error(&error))?;
    Ok(SentIds {
        provider_message_id: prepared.message_id.clone(),
        provider_thread_id: prepared.thread_id.clone(),
    })
}

/// Only a permanent relay response proves the message was refused; every other
/// failure may have been accepted before the connection broke.
fn classify_smtp_error(error: &lettre::transport::smtp::Error) -> SubmissionError {
    match error.status() {
        Some(code) if error.is_permanent() => {
            SubmissionError::Rejected(anyhow::anyhow!("SMTP relay refused the message: {code}"))
        }
        Some(code) => SubmissionError::Uncertain(anyhow::anyhow!("SMTP relay answered: {code}")),
        None => SubmissionError::Uncertain(anyhow::anyhow!("SMTP relay connection failed")),
    }
}

fn classify_preparation_error(error: anyhow::Error) -> PreparationError {
    if error.is::<SenderMissing>() {
        return PreparationError::SenderMissing(SenderMissing);
    }
    if error.is::<AttachmentSnapshotMismatch>()
        || error.is::<PreparedSendContentUnavailable>()
        || error.downcast_ref::<email::domain::forwarded_attachments::ForwardedAttachmentError>().is_some_and(|error| matches!(error, email::domain::forwarded_attachments::ForwardedAttachmentError::DraftNotFound | email::domain::forwarded_attachments::ForwardedAttachmentError::AttachmentNotFound))
        || error.downcast_ref::<EmailApiError>().is_some_and(|error| {
            matches!(
                error,
                EmailApiError::AuthRequired
                    | EmailApiError::Forbidden
                    | EmailApiError::NotFound
                    | EmailApiError::Conflict
                    | EmailApiError::SendRejected { .. }
                    | EmailApiError::Permanent { .. }
            )
        })
    {
        PreparationError::Failed(error)
    } else {
        PreparationError::Retry(error)
    }
}

fn classify_submission_error(error: EmailApiError) -> SubmissionError {
    // Transport failures, server failures, and malformed success responses
    // cannot establish that Gmail refused delivery.
    match error {
        EmailApiError::AuthRequired
        | EmailApiError::Forbidden
        | EmailApiError::NotFound
        | EmailApiError::Conflict
        | EmailApiError::SendRejected { .. }
        | EmailApiError::RateLimited { .. } => SubmissionError::Rejected(error.into()),
        _ => SubmissionError::Uncertain(error.into()),
    }
}

fn apply_sent_ids(message: &mut MessageToSend, sent_ids: SentIds) {
    message.provider_id = Some(sent_ids.provider_message_id);
    message.provider_thread_id = Some(sent_ids.provider_thread_id);
}

#[cfg(test)]
mod test;
