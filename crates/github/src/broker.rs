//! Broker envelope and publication for verified GitHub App deliveries.

use crate::domain::models::GithubWebhookReceived;
use rox_event_broker::{Event, RoxEvent, TopicEvent};
use rox_event_topics::RoxGithubWebhooksTopic;
use serde::{Deserialize, Serialize};

/// Facts published to `macro.github_webhooks`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "event_type", content = "metadata")]
pub enum GithubWebhookTopicEvent {
    /// The GitHub App received and verified a delivery.
    #[serde(rename = "github_webhook.received")]
    Received(GithubWebhookReceived),
}

impl TopicEvent for GithubWebhookTopicEvent {
    type Topic = RoxGithubWebhooksTopic;
    const SCHEMA_VERSION: u8 = 1;
}

/// A delivery keyed by installation, so one installation's deliveries keep
/// their order.
#[derive(Debug, Clone)]
pub struct GithubWebhookRoxEvent {
    key: String,
    event: Event<GithubWebhookTopicEvent>,
}

impl GithubWebhookRoxEvent {
    /// Wrap a verified delivery.
    pub fn received(delivery: GithubWebhookReceived) -> Self {
        Self {
            key: delivery.installation_id.to_string(),
            event: Event::new(GithubWebhookTopicEvent::Received(delivery)),
        }
    }
}

impl RoxEvent for GithubWebhookRoxEvent {
    type EventPayload = GithubWebhookTopicEvent;
    fn key(&self) -> &str {
        &self.key
    }
    fn event(&self) -> &Event<Self::EventPayload> {
        &self.event
    }
    fn from_event(key: String, event: Event<Self::EventPayload>) -> Self {
        Self { key, event }
    }
}

/// Publishes deliveries through the shared event broker.
#[cfg(feature = "sync")]
pub struct BrokerGithubWebhookPublisher<B>(pub B);

#[cfg(feature = "sync")]
impl<B: rox_event_broker::RoxEventBroker> crate::domain::ports::GithubWebhookPublisher
    for BrokerGithubWebhookPublisher<B>
{
    fn publish_received(
        &self,
        delivery: GithubWebhookReceived,
    ) -> std::pin::Pin<
        Box<
            dyn std::future::Future<Output = Result<(), crate::domain::models::GithubError>>
                + Send
                + '_,
        >,
    > {
        Box::pin(async move {
            self.0
                .send_event(&GithubWebhookRoxEvent::received(delivery))
                .map_err(anyhow::Error::from)?
                .await
                .map_err(anyhow::Error::from)?
                .map_err(anyhow::Error::from)?;
            Ok(())
        })
    }
}
