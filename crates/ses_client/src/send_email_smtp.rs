//! SMTP delivery for every environment that is not SES.
//!
//! Two shapes share this transport: the local Mailpit sink (plaintext, no
//! auth — Mailpit accepts anything) and a real relay such as Resend, which
//! needs STARTTLS/SSL and credentials. Both are selected by the same `SMTP_*`
//! variables, so switching a stand between them is an env edit only.

use anyhow::{Context, Result, anyhow};
use lettre::message::Mailbox;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

/// Wire security for the SMTP hop, chosen by `SMTP_TLS`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SmtpSecurity {
    /// Plaintext, no TLS (Mailpit on port 1025).
    None,
    /// Upgrade with STARTTLS on the submission port (Resend on 587).
    StartTls,
    /// Implicit TLS from the first byte, SMTPS (port 465).
    Ssl,
}

impl SmtpSecurity {
    /// Parse `SMTP_TLS`; an unset or unrecognised value keeps the old plaintext
    /// behaviour so Mailpit setups keep working untouched.
    pub fn from_env_value(value: Option<&str>) -> Self {
        match value.map(|v| v.trim().to_ascii_lowercase()).as_deref() {
            Some("starttls") => Self::StartTls,
            Some("ssl") | Some("smtps") | Some("tls") => Self::Ssl,
            _ => Self::None,
        }
    }
}

/// Everything the delivery function needs for one SMTP relay.
#[derive(Clone, Debug)]
pub struct SmtpRelay {
    pub host: String,
    pub port: u16,
    pub security: SmtpSecurity,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl SmtpRelay {
    fn credentials(&self) -> Option<Credentials> {
        match (&self.username, &self.password) {
            (Some(user), Some(pass)) => Some(Credentials::new(user.clone(), pass.clone())),
            (Some(_), None) => {
                tracing::warn!("SMTP_USERNAME is set without SMTP_PASSWORD; sending unauthenticated");
                None
            }
            (None, Some(_)) => {
                tracing::warn!("SMTP_PASSWORD is set without SMTP_USERNAME; sending unauthenticated");
                None
            }
            (None, None) => None,
        }
    }
}

/// Send an HTML email over SMTP, honouring the relay's TLS mode and credentials.
pub async fn send_email_smtp(
    relay: &SmtpRelay,
    from_email: &str,
    to_email: &str,
    subject: &str,
    content: &str,
) -> Result<()> {
    let from = mailbox(from_email).context("parsing from address")?;
    let to = mailbox(to_email).context("parsing to address")?;

    let email = Message::builder()
        .from(from)
        .to(to)
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(content.to_string())
        .context("building SMTP message")?;

    let mailer = build_mailer(relay)?;

    tracing::debug!(
        host = %relay.host,
        port = relay.port,
        security = ?relay.security,
        authenticated = relay.credentials().is_some(),
        "sending email over SMTP"
    );

    mailer.send(email).await.context("sending via SMTP")?;
    Ok(())
}

fn build_mailer(relay: &SmtpRelay) -> Result<AsyncSmtpTransport<Tokio1Executor>> {
    let builder = match relay.security {
        SmtpSecurity::None => {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(relay.host.as_str())
                .port(relay.port)
        }
        SmtpSecurity::StartTls => {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(relay.host.as_str())
                .map_err(|e| anyhow!("configuring STARTTLS for {}: {e}", relay.host))?
                .port(relay.port)
        }
        SmtpSecurity::Ssl => {
            AsyncSmtpTransport::<Tokio1Executor>::relay(relay.host.as_str())
                .map_err(|e| anyhow!("configuring implicit TLS for {}: {e}", relay.host))?
                .port(relay.port)
        }
    };

    let builder = match relay.credentials() {
        Some(credentials) => builder.credentials(credentials),
        None => builder,
    };

    Ok(builder.build())
}

fn mailbox(email: &str) -> Result<Mailbox> {
    let address: Address = email
        .parse()
        .with_context(|| format!("invalid email '{email}'"))?;
    Ok(Mailbox::new(None, address))
}
