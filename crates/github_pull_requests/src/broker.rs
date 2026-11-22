//! Broker envelopes and publication for persisted pull request updates.
use crate::domain::events::GithubPullRequestUpdated;
use rox_event_broker::{Event, RoxEvent, TopicEvent};
use rox_event_topics::RoxGithubPullRequestsTopic;
use serde::{Deserialize, Serialize};

/// Facts published to the pull request topic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "event_type", content = "metadata")]
pub enum GithubPullRequestTopicEvent {
    /// Stored PR metadata changed.
    #[serde(rename = "github_pull_request.updated")]
    Updated(GithubPullRequestUpdated),
}
impl TopicEvent for GithubPullRequestTopicEvent {
    type Topic = RoxGithubPullRequestsTopic;
    const SCHEMA_VERSION: u8 = 1;
}
/// An event keyed by PR so updates retain per-PR ordering.
#[derive(Debug, Clone)]
pub struct GithubPullRequestRoxEvent {
    key: String,
    event: Event<GithubPullRequestTopicEvent>,
}
impl GithubPullRequestRoxEvent {
    /// Wrap a committed PR change.
    pub fn updated(update: GithubPullRequestUpdated) -> Self {
        Self {
            key: update.github_key.to_lowercase(),
            event: Event::new(GithubPullRequestTopicEvent::Updated(update)),
        }
    }
}
impl RoxEvent for GithubPullRequestRoxEvent {
    type EventPayload = GithubPullRequestTopicEvent;
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
/// Publishes PR facts through the shared event broker.
pub struct BrokerGithubPullRequestPublisher<B>(pub B);
#[cfg(feature = "ports")]
impl<B: rox_event_broker::RoxEventBroker> crate::domain::ports::GithubPullRequestEventPublisher
    for BrokerGithubPullRequestPublisher<B>
{
    fn publish_updated(
        &self,
        update: GithubPullRequestUpdated,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<(), rootcause::Report>> + Send + '_>,
    > {
        Box::pin(async move {
            use rootcause::prelude::ResultExt as _;
            self.0
                .send_event(&GithubPullRequestRoxEvent::updated(update))
                .context("enqueueing PR update")?
                .await
                .context("joining PR publication")?
                .context("publishing PR update")?;
            Ok(())
        })
    }
}
