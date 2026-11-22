#![deny(missing_docs)]
//! Defines all topics for kafka.
//! This file is also programmatically grabbed in infra to ensure all kafka topics are created.

#[cfg(test)]
mod test;

use sealed::sealed;

/// Errors that can occur for a Topic
#[derive(Debug, thiserror::Error)]
pub enum TopicError {
    /// The Kafka topic name is not known to this broker crate.
    #[error("unknown event topic: {0}")]
    UnknownTopic(String),
}

/// A Topic is mapped to a Kafka topic that events can be published to.
#[sealed]
pub trait Topic: Copy + Send + Sync + 'static {
    /// the statically known string name of this topic
    const TOPIC_STR: &'static str;
}

/// Defines each topic struct with its `Topic` impl, plus [`all_topic_names`]
/// so every declared topic is automatically included in the registry.
macro_rules! topics {
    ($($(#[$meta:meta])* $name:ident => $topic:literal),* $(,)?) => {
        $(
            $(#[$meta])*
            #[derive(Default, Debug, Clone, Copy, PartialEq, Eq, Hash)]
            pub struct $name;

            #[sealed]
            impl Topic for $name {
                const TOPIC_STR: &'static str = $topic;
            }
        )*

        /// The names of all Kafka topics defined in this crate.
        pub fn all_topic_names() -> &'static [&'static str] {
            &[$($name::TOPIC_STR),*]
        }
    };
}

topics! {
    /// Example kafka topic.
    RoxExampleTopic => "rox.example",
    /// Bot lifecycle events (created / updated / deleted).
    RoxBotsTopic => "rox.bots",
    /// Call lifecycle and recording events.
    RoxCallsTopic => "rox.calls",
    /// Public call notifications for webhooks and event streams.
    RoxCallNotificationsTopic => "rox.call_notifications",
    /// Document lifecycle events (created / updated / deleted / copied).
    RoxDocumentsTopic => "rox.documents",
    /// Committed GitHub pull request updates.
    RoxGithubPullRequestsTopic => "rox.github_pull_requests",
    /// Every delivery the GitHub App verified, whatever its event.
    RoxGithubWebhooksTopic => "rox.github_webhooks",
    /// User-scoped full Soup items produced from entity updates.
    RoxSoupRealtimeTopic => "rox.soup",
    /// Project lifecycle events (created, updated, deleted, restored, permanently deleted, and uploaded).
    RoxProjectsTopic => "rox.projects",
    /// Initiative lifecycle and task membership changes.
    RoxInitiativesTopic => "rox.initiatives",
    /// Property definition, option, and entity property value mutation events.
    RoxPropertiesTopic => "rox.properties",
    /// Team lifecycle, invite, and membership events.
    RoxTeamsTopic => "rox.teams",
    /// Channel lifecycle, message, participant, and attachment events.
    RoxChannelsTopic => "rox.channels",
    /// Shared channel and document message events.
    RoxMessagesTopic => "rox.messages",
    /// Signals telling the agent harness to open or feed an agent session.
    RoxAgentSessionsTopic => "rox.agent_sessions",
    /// Email lifecycle events (links, messages, threads, labels).
    RoxEmailTopic => "rox.email",
    /// Webhook configuration lifecycle events (created / updated / deleted / validated).
    RoxWebhooksTopic => "rox.webhooks",
    /// Entity mention events (created / deleted) across channels and docs.
    RoxMentionsTopic => "rox.mentions",
    /// Notifications awaiting delivery through WebSocket connections.
    RoxNotificationsTopic => "rox.notifications",
    /// Recorded activity rows awaiting delivery to realtime subscribers.
    RoxActivityTopic => "rox.activity",
    /// AI chat lifecycle and message events.
    RoxChatsTopic => "rox.chats",
    /// Calendar event changes, from provider sync and user mutations alike.
    RoxCalendarTopic => "rox.calendar",
    /// Agent session lifecycle facts: opened, turns, waiting for input, settled, stopped, renamed, deleted.
    RoxAgentSessionLifecycleTopic => "rox.agent_session_lifecycle",
    /// Retired: runs of appended agent session log frames now travel over a
    /// Redis Stream (`agent_session_realtime::outbound::redis_stream`). Kept
    /// declared until every harness task publishing here has been replaced;
    /// remove it, and its cluster topic, after that rollout.
    RoxAgentSessionLogTopic => "rox.agent_session_log",
    /// Database lifecycle (created, renamed, trashed, restored, purged) and table-change events.
    RoxDatabasesTopic => "rox.databases",
    /// Form lifecycle (created, renamed, trashed, restored, purged), sharing and response events.
    RoxFormsTopic => "rox.forms",
    /// User profile changes, such as a new profile picture.
    RoxUsersTopic => "rox.users",
}
