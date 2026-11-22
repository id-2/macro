mod invite_user;
mod send_email;
mod send_email_smtp;

use aws_sdk_sesv2 as ses;
#[allow(unused_imports)]
use mockall::automock;

rox_env_var::maybe_env_vars! {
    struct SmtpHost;
    struct SmtpPort;
    struct SmtpUsername;
    struct SmtpPassword;
    struct SmtpTls;
}

#[cfg(test)]
pub use MockSesClient as Ses;
#[cfg(not(test))]
pub use SesClient as Ses;

/// How outbound mail is delivered. SES in dev/prod; SMTP in local mode or when
/// a relay such as Resend is configured through the `SMTP_*` env vars.
#[derive(Clone, Debug)]
enum Transport {
    Ses(ses::Client),
    Smtp(send_email_smtp::SmtpRelay),
}

#[derive(Clone, Debug)]
pub struct SesClient {
    transport: Transport,
    invite_email: Option<String>,
    environment: String,
}

#[cfg_attr(test, automock)]
impl SesClient {
    /// Construct from the environment: route to SMTP when `SMTP_HOST` is set
    /// (Mailpit for tests, Resend or another relay for real delivery), else to
    /// SES. The SES client is still passed in (and kept for the SES path) so
    /// callers don't branch.
    pub fn from_env(inner: ses::Client, environment: &str) -> Self {
        let transport = match SmtpHost::new().and_then(|host| host.value().map(str::to_string)) {
            Some(host) if !host.is_empty() => {
                let port = SmtpPort::new()
                    .and_then(|p| p.value().and_then(|p| p.parse().ok()))
                    .unwrap_or(1025);
                let relay = send_email_smtp::SmtpRelay {
                    host,
                    port,
                    security: send_email_smtp::SmtpSecurity::from_env_value(
                        SmtpTls::new()
                            .and_then(|tls| tls.value().map(str::to_string))
                            .as_deref(),
                    ),
                    username: SmtpUsername::new()
                        .and_then(|v| v.value().map(str::to_string))
                        .filter(|v| !v.is_empty()),
                    password: SmtpPassword::new()
                        .and_then(|v| v.value().map(str::to_string))
                        .filter(|v| !v.is_empty()),
                };
                Transport::Smtp(relay)
            }
            _ => Transport::Ses(inner),
        };
        Self {
            transport,
            invite_email: None,
            environment: environment.to_string(),
        }
    }

    /// Sets the invite_email
    pub fn invite_email(mut self, invite_email: &str) -> Self {
        self.invite_email = Some(invite_email.to_string());
        self
    }

    /// Sends an invitation email to the user
    #[tracing::instrument(skip(self))]
    pub async fn invite_user(&self, organization_name: &str, email: &str) -> anyhow::Result<()> {
        let Some(invite_email) = self.invite_email.clone() else {
            return Err(anyhow::anyhow!("invite_email is not set"));
        };
        let html = invite_user::build_user_invite_message(organization_name, &self.environment);
        self.deliver(
            &invite_email,
            email,
            invite_user::INVITE_USER_SUBJECT,
            &html,
        )
        .await
    }

    /// Sends an email to the user
    #[tracing::instrument(skip(self, subject, content))]
    pub async fn send_email(
        &self,
        from_email: &str,
        to_email: &str,
        subject: &str,
        content: &str,
    ) -> anyhow::Result<()> {
        self.deliver(from_email, to_email, subject, content).await
    }
}

impl SesClient {
    /// Route a fully-rendered HTML email through the active transport.
    async fn deliver(
        &self,
        from_email: &str,
        to_email: &str,
        subject: &str,
        content: &str,
    ) -> anyhow::Result<()> {
        match &self.transport {
            Transport::Ses(client) => {
                send_email::send_email(client, from_email, to_email, subject, content).await
            }
            Transport::Smtp(relay) => {
                send_email_smtp::send_email_smtp(
                    relay, from_email, to_email, subject, content,
                )
                .await
            }
        }
    }
}
