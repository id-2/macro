//! Ingestion of one received message into a Rox-hosted mailbox.
//!
//! A Rox mailbox has no provider change feed to poll: the mail host posts each
//! received message here instead. The write goes through the same
//! `email_db_client` message repository the Gmail and Outlook mailbox workers
//! use, and it writes a normalized `mailbox_state`, so inbox previews, thread
//! metadata and the rest of the read path treat the message exactly like
//! synchronized mail.
//!
//! A message is keyed on its own Message-ID inside one mailbox, so a
//! redelivered notification leaves a single row and answers with the stored
//! ids. A reply may carry `in_reply_to`, the Message-ID of the message it
//! answers; when that message is already stored in the same mailbox, the reply
//! joins its thread. Without that reference a message starts its own thread,
//! mirroring the hosting design's refusal to merge threads on subject alone.

use std::collections::HashSet;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use chrono::{DateTime, Utc};
use email_api_client::domain::models::{Attention, MailboxState};
use model::response::ErrorResponse;
use models_email::email::service::{
    address::ContactInfo,
    link::{Link, UserProvider},
    message::Message,
    thread::Thread,
};
use rox_authorization::{InternalOnly, RoxAuthorizationExtractor};
use rox_user_id::email::EmailStr;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::{ApiContext, context::AuthorizationService};

#[cfg(test)]
mod test;

/// The snippet length the inbox preview expects from stored mail.
const SNIPPET_CHARS: usize = 300;

/// SES accepts inbound mail up to 40 MB; axum's 2 MB default would reject
/// messages the mail host can legitimately deliver.
const BODY_LIMIT_BYTES: usize = 40 * 1024 * 1024;

pub fn router() -> Router<ApiContext> {
    Router::new()
        .route("/", post(handler))
        .layer(DefaultBodyLimit::max(BODY_LIMIT_BYTES))
}

/// One address on a received message. Accepted either as a plain address
/// string or as an object with `email` and an optional display name.
#[derive(Debug, Clone)]
pub struct InboundAddress {
    pub email: String,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum InboundAddressRepr {
    Plain(String),
    Detailed {
        email: String,
        #[serde(default)]
        name: Option<String>,
    },
}

impl<'de> Deserialize<'de> for InboundAddress {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Ok(match InboundAddressRepr::deserialize(deserializer)? {
            InboundAddressRepr::Plain(email) => Self { email, name: None },
            InboundAddressRepr::Detailed { email, name } => Self { email, name },
        })
    }
}

/// One received message, as already parsed by the mail host.
#[derive(Debug, Deserialize)]
pub struct InboundMessage {
    /// RFC 5322 Message-ID, with or without angle brackets.
    pub message_id: String,
    pub sender: InboundAddress,
    /// `To`, `Cc` and `Bcc` recipients of the delivered copy.
    pub recipients: Vec<InboundAddress>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub body_text: Option<String>,
    #[serde(default)]
    pub body_html: Option<String>,
    /// When the receiving server accepted the message. Defaults to receipt
    /// time when the mail host does not send one.
    #[serde(default = "Utc::now")]
    pub received_at: DateTime<Utc>,
    /// Message-ID of the message this one answers, when the mail host has it.
    #[serde(default)]
    pub in_reply_to: Option<String>,
    /// SMTP envelope recipient this copy is delivered for. Defaults to the
    /// first recipient that belongs to a Rox mailbox, checked in the order
    /// given, so one request writes one mailbox copy.
    #[serde(default)]
    pub mailbox: Option<String>,
}

/// Identifiers a caller keeps to correlate the stored copy.
#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub link_id: Uuid,
    pub thread_id: Uuid,
    pub message_db_id: Uuid,
    /// True when the message id was already stored and nothing was written.
    pub duplicate: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error("{0}")]
    Invalid(String),
    #[error("no Rox mailbox owns any of the recipient addresses")]
    MailboxNotFound,
    #[error("the Rox mailbox is disconnecting and cannot receive mail")]
    Disconnecting,
    #[error("database error")]
    Sqlx(#[from] sqlx::Error),
    #[error("database error")]
    Database(#[from] anyhow::Error),
}

impl IntoResponse for IngestError {
    fn into_response(self) -> Response {
        if !matches!(&self, Self::Invalid(_) | Self::MailboxNotFound | Self::Disconnecting) {
            tracing::error!(error = %self, "inbound mail could not be stored");
        }
        let status = match &self {
            Self::Invalid(_) => StatusCode::BAD_REQUEST,
            Self::MailboxNotFound => StatusCode::NOT_FOUND,
            Self::Disconnecting => StatusCode::CONFLICT,
            Self::Sqlx(_) | Self::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (
            status,
            Json(ErrorResponse {
                message: self.to_string().into(),
            }),
        )
            .into_response()
    }
}

/// Validated and normalized form of [`InboundMessage`].
#[derive(Debug)]
struct PreparedMessage {
    message_id: String,
    mailbox: Option<String>,
    sender: ContactInfo,
    recipients: Vec<ContactInfo>,
    subject: Option<String>,
    body_text: Option<String>,
    body_html: Option<String>,
    received_at: DateTime<Utc>,
    in_reply_to: Option<String>,
}

/// Accepts one received message for a Rox mailbox.
///
/// The endpoint is internal: the mail host authenticates with the service's
/// internal key. Redelivery of the same Message-ID is a no-op that answers
/// `200 OK` with the stored ids; a first delivery answers `201 Created`.
#[tracing::instrument(
    skip(ctx, request),
    fields(message_id = %request.message_id, recipient_count = request.recipients.len())
)]
pub(crate) async fn handler(
    State(ctx): State<ApiContext>,
    _: RoxAuthorizationExtractor<AuthorizationService, InternalOnly>,
    Json(request): Json<InboundMessage>,
) -> Result<(StatusCode, Json<IngestResponse>), IngestError> {
    let prepared = request.validate()?;
    let response = ingest(&ctx.inbox_connection.links.db, &prepared).await?;
    let status = if response.duplicate {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };
    Ok((status, Json(response)))
}

impl InboundMessage {
    fn validate(self) -> Result<PreparedMessage, IngestError> {
        let message_id = normalize_message_id(&self.message_id)?;
        let mailbox = self
            .mailbox
            .as_deref()
            .map(|address| parse_address(address, None, "mailbox"))
            .transpose()?
            .map(|address| address.email.to_lowercase());
        let sender = parse_address(
            &self.sender.email,
            self.sender.name.as_deref(),
            "sender",
        )?;
        if self.recipients.is_empty() {
            return Err(IngestError::Invalid("recipients must not be empty".into()));
        }
        let recipients = self
            .recipients
            .iter()
            .map(|address| parse_address(&address.email, address.name.as_deref(), "recipient"))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(PreparedMessage {
            message_id,
            mailbox,
            sender,
            recipients,
            subject: non_empty(self.subject),
            body_text: non_empty(self.body_text),
            body_html: non_empty(self.body_html),
            received_at: self.received_at,
            in_reply_to: self
                .in_reply_to
                .as_deref()
                .map(normalize_message_id)
                .transpose()?,
        })
    }
}

/// Strips the optional angle brackets and rejects ids that cannot key a row.
fn normalize_message_id(raw: &str) -> Result<String, IngestError> {
    let trimmed = raw.trim();
    let inner = trimmed
        .strip_prefix('<')
        .and_then(|rest| rest.strip_suffix('>'))
        .unwrap_or(trimmed)
        .trim();
    if inner.is_empty() {
        return Err(IngestError::Invalid("message_id must not be empty".into()));
    }
    if inner.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(IngestError::Invalid(
            "message_id must not contain whitespace".into(),
        ));
    }
    Ok(inner.to_owned())
}

/// Validates an address and trims the display name.
fn parse_address(
    email: &str,
    name: Option<&str>,
    field: &str,
) -> Result<ContactInfo, IngestError> {
    let email = email.trim();
    EmailStr::parse_from_str(email)
        .map_err(|_| IngestError::Invalid(format!("{field} is not a valid email address")))?;
    Ok(ContactInfo {
        email: email.to_owned(),
        name: name
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_owned),
        photo_url: None,
    })
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty())
}

/// A stored message, looked up by its mailbox and Message-ID.
#[derive(sqlx::FromRow)]
struct StoredMessage {
    id: Uuid,
    thread_id: Uuid,
}

async fn ingest(pool: &PgPool, request: &PreparedMessage) -> Result<IngestResponse, IngestError> {
    let (link, sync_generation) = resolve_mailbox(pool, request).await?;
    if let Some(stored) = stored_message(pool, link.id, &request.message_id).await? {
        return Ok(IngestResponse {
            link_id: link.id,
            thread_id: stored.thread_id,
            message_db_id: stored.id,
            duplicate: true,
        });
    }

    let mut message = build_message(request, link.id);
    // Contacts are shared across messages, so they are upserted outside the
    // message transaction where locks on them could deadlock.
    let addresses = email_db_client::parse::service_to_db::addresses_from_message(&message);
    let contacts = email_db_client::contacts::upsert_message::parse_and_upsert_message_contacts(
        pool, link.id, addresses,
    )
    .await?;

    let mut tx = pool.begin().await?;
    // Removal locks the same row to freeze ingestion, so a mailbox that starts
    // disconnecting before this write wins the race.
    let disconnecting: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT disconnect_requested_at FROM email_links WHERE id = $1 FOR UPDATE",
    )
    .bind(link.id)
    .fetch_one(&mut *tx)
    .await?;
    if disconnecting.is_some() {
        return Err(IngestError::Disconnecting);
    }
    let (thread_id, provider_thread_id, replying_to_id, is_new_thread) = resolve_thread(
        &mut tx,
        link.id,
        &request.message_id,
        request.in_reply_to.as_deref(),
    )
    .await?;
    message.thread_db_id = thread_id;
    message.provider_thread_id = Some(provider_thread_id);
    message.replying_to_id = replying_to_id;
    email_db_client::messages::insert::insert_message_with_tx(
        &mut tx,
        thread_id,
        &mut message,
        link.id,
        contacts,
        false,
        None,
    )
    .await?;
    // The upsert above may have settled on a row written by a concurrent
    // delivery of the same Message-ID, so the stored row is the answer.
    let stored = sqlx::query_as::<_, StoredMessage>(
        "SELECT id, thread_id FROM email_messages WHERE link_id = $1 AND provider_id = $2",
    )
    .bind(link.id)
    .bind(&request.message_id)
    .fetch_one(&mut *tx)
    .await?;
    let state = serde_json::to_value(MailboxState {
        in_inbox: true,
        attention: Attention::Primary,
        ..MailboxState::default()
    })
    .map_err(anyhow::Error::from)?;
    sqlx::query("UPDATE email_messages SET mailbox_state = $3 WHERE id = $1 AND link_id = $2")
        .bind(stored.id)
        .bind(link.id)
        .bind(&state)
        .execute(&mut *tx)
        .await?;
    email_db_client::threads::update::recompute_thread_metadata(
        &mut tx,
        stored.thread_id,
        link.id,
    )
    .await?;
    // The same projection event the Outlook worker publishes: search, CRM and
    // notifications pick the message up once the link is claimed. The dedupe
    // key keeps a concurrent redelivery from queueing a second event.
    let payload = serde_json::json!({
        "kind": "message",
        "message_id": stored.id,
        "thread_id": stored.thread_id,
        "provider_id": request.message_id,
        "is_import": false,
        "is_new": true,
        "is_new_thread": is_new_thread,
        "was_draft": false,
        "is_draft": false,
        "is_sent": false,
        "calendar_parts": [],
    });
    sqlx::query(
        "INSERT INTO email_projection_outbox (id, link_id, generation, payload, dedupe_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dedupe_key) DO NOTHING",
    )
    .bind(rox_uuid::generate_uuid_v7())
    .bind(link.id)
    .bind(sync_generation)
    .bind(&payload)
    .bind(format!("inbound/{}/{}", link.id, request.message_id))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(IngestResponse {
        link_id: link.id,
        thread_id: stored.thread_id,
        message_db_id: stored.id,
        duplicate: false,
    })
}

/// Finds the Rox mailbox this copy is delivered for and its sync generation.
async fn resolve_mailbox(
    pool: &PgPool,
    request: &PreparedMessage,
) -> Result<(Link, i64), IngestError> {
    let candidates: Vec<&str> = match &request.mailbox {
        Some(mailbox) => vec![mailbox.as_str()],
        None => request
            .recipients
            .iter()
            .map(|recipient| recipient.email.as_str())
            .collect(),
    };
    let mut seen = HashSet::new();
    for candidate in candidates {
        // Stored Rox addresses are canonical lowercase; the index lookup must
        // match them exactly.
        let address = candidate.to_lowercase();
        if !seen.insert(address.clone()) {
            continue;
        }
        let Some(link) =
            email_db_client::links::get::fetch_link_by_email(pool, &address, UserProvider::Rox)
                .await?
        else {
            continue;
        };
        let sync_generation: i64 =
            sqlx::query_scalar("SELECT sync_generation FROM email_links WHERE id = $1")
                .bind(link.id)
                .fetch_one(pool)
                .await?;
        return Ok((link, sync_generation));
    }
    Err(IngestError::MailboxNotFound)
}

async fn stored_message(
    pool: &PgPool,
    link_id: Uuid,
    message_id: &str,
) -> Result<Option<StoredMessage>, IngestError> {
    Ok(sqlx::query_as::<_, StoredMessage>(
        "SELECT id, thread_id FROM email_messages WHERE link_id = $1 AND provider_id = $2",
    )
    .bind(link_id)
    .bind(message_id)
    .fetch_optional(pool)
    .await?)
}

/// The thread a new message belongs to, its Rox-minted provider thread id, the
/// stored message it answers (if any), and whether the thread was created now.
async fn resolve_thread(
    conn: &mut sqlx::PgConnection,
    link_id: Uuid,
    message_id: &str,
    in_reply_to: Option<&str>,
) -> Result<(Uuid, String, Option<Uuid>, bool), IngestError> {
    if let Some(reference) = in_reply_to {
        let answered = sqlx::query_as::<_, StoredMessage>(
            "SELECT id, thread_id FROM email_messages
             WHERE link_id = $1 AND (provider_id = $2 OR global_id = $3)
             ORDER BY internal_date_ts DESC NULLS LAST, id LIMIT 1",
        )
        .bind(link_id)
        .bind(reference)
        .bind(format!("<{reference}>"))
        .fetch_optional(&mut *conn)
        .await?;
        if let Some(answered) = answered {
            let provider_thread_id: Option<String> = sqlx::query_scalar(
                "SELECT provider_id FROM email_threads WHERE id = $1 AND link_id = $2",
            )
            .bind(answered.thread_id)
            .bind(link_id)
            .fetch_one(&mut *conn)
            .await?;
            let provider_thread_id =
                provider_thread_id.unwrap_or_else(|| format!("rox:{reference}"));
            return Ok((
                answered.thread_id,
                provider_thread_id,
                Some(answered.id),
                false,
            ));
        }
    }
    // The root message's Message-ID names the conversation. Two deliveries of
    // the same root land on the one thread the unique index allows.
    let provider_thread_id = format!("rox:{message_id}");
    let thread = Thread {
        db_id: rox_uuid::generate_uuid_v7(),
        provider_id: Some(provider_thread_id.clone()),
        link_id,
        inbox_visible: false,
        is_read: false,
        latest_inbound_message_ts: None,
        latest_outbound_message_ts: None,
        latest_non_spam_message_ts: None,
        created_at: Default::default(),
        updated_at: Default::default(),
        messages: Vec::new(),
    };
    let thread_id = email_db_client::threads::insert::insert_thread(&mut *conn, &thread, link_id)
        .await?;
    // A conflict resolves to the stored row, not the proposed one.
    Ok((
        thread_id,
        provider_thread_id,
        None,
        thread_id == thread.db_id,
    ))
}

fn build_message(request: &PreparedMessage, link_id: Uuid) -> Message {
    let size_estimate = request
        .body_text
        .as_ref()
        .map_or(0, |body| body.len() as i64)
        + request
            .body_html
            .as_ref()
            .map_or(0, |body| body.len() as i64);
    let mut headers = vec![serde_json::json!({
        "name": "Message-ID",
        "value": format!("<{}>", request.message_id),
    })];
    if let Some(reference) = &request.in_reply_to {
        headers.push(serde_json::json!({
            "name": "In-Reply-To",
            "value": format!("<{reference}>"),
        }));
    }
    Message {
        db_id: rox_uuid::generate_uuid_v7(),
        provider_id: Some(request.message_id.clone()),
        thread_db_id: Uuid::nil(),
        provider_thread_id: None,
        replying_to_id: None,
        global_id: Some(format!("<{}>", request.message_id)),
        link_id,
        subject: request.subject.clone(),
        snippet: snippet(request),
        provider_history_id: None,
        internal_date_ts: Some(request.received_at),
        sent_at: Some(request.received_at),
        size_estimate: Some(size_estimate),
        is_read: false,
        is_starred: false,
        is_sent: false,
        is_draft: false,
        scheduled_send_time: None,
        has_attachments: false,
        from: Some(request.sender.clone()),
        to: request.recipients.clone(),
        cc: Vec::new(),
        bcc: Vec::new(),
        labels: Vec::new(),
        body_text: request.body_text.clone(),
        body_html_sanitized: request
            .body_html
            .as_deref()
            .map(email_utils::sanitize_html_fragment),
        body_rox: None,
        attachments: Vec::new(),
        attachments_draft: Vec::new(),
        attachments_forwarded: Vec::new(),
        headers_json: Some(serde_json::Value::Array(headers)),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// The preview snippet: one line of plain text, at most [`SNIPPET_CHARS`].
fn snippet(request: &PreparedMessage) -> Option<String> {
    let from_html = request
        .body_text
        .is_none()
        .then(|| {
            request
                .body_html
                .as_deref()
                .and_then(email_utils::body_parsed::html_to_plaintext)
        })
        .flatten();
    let text = request.body_text.as_deref().or(from_html.as_deref())?;
    let line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let clamped: String = line.chars().take(SNIPPET_CHARS).collect();
    (!clamped.is_empty()).then_some(clamped)
}
