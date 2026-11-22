#![deny(missing_docs)]
//! Kafka event models for the `macro.users` topic: changes to a user's own
//! profile that other people see.
//!
//! Follows the canonical pattern in `documents/src/domain/events.rs`:
//! per-variant metadata structs, a [`TopicEvent`] enum tagged by `event_type`,
//! and a [`RoxEvent`] wrapper keyed by user id.

#[cfg(test)]
mod test;

use rox_event_broker::{Event, RoxEvent, TopicEvent};
use rox_event_topics::RoxUsersTopic;
use rox_user_id::user_id::RoxUserIdStr;
use serde::{Deserialize, Serialize};

/// Metadata for [`UserTopicEvent::PictureChanged`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(utoipa::ToSchema))]
pub struct UserPictureChangedMetadata {
    /// User whose profile picture changed.
    pub user_id: RoxUserIdStr<'static>,
    /// Static file id of the new picture; `None` when it is not a static file
    /// (set by URL) or the picture was removed.
    pub file_id: Option<String>,
    /// URL of the new picture; `None` when the picture was removed.
    pub url: Option<String>,
}

/// Events that can be published to [`RoxUsersTopic`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "event_type", content = "metadata")]
#[cfg_attr(feature = "schema", derive(utoipa::ToSchema))]
pub enum UserTopicEvent {
    /// A user's profile picture changed or was removed.
    #[serde(rename = "user.picture_changed")]
    PictureChanged(UserPictureChangedMetadata),
}

impl TopicEvent for UserTopicEvent {
    type Topic = RoxUsersTopic;

    const SCHEMA_VERSION: u8 = 1;
}

/// Publishable event for [`RoxUsersTopic`], keyed by user id so one user's
/// changes stay ordered on one partition.
pub struct UserRoxEvent {
    key: String,
    event: Event<UserTopicEvent>,
}

impl UserRoxEvent {
    /// Build a picture changed event keyed by the user id.
    pub fn picture_changed(metadata: UserPictureChangedMetadata) -> Self {
        Self::with_event(
            metadata.user_id.as_ref().to_string(),
            Event::new(UserTopicEvent::PictureChanged(metadata)),
        )
    }

    /// Build an event from a pre-built envelope.
    pub fn with_event(key: impl Into<String>, event: Event<UserTopicEvent>) -> Self {
        Self {
            key: key.into(),
            event,
        }
    }
}

impl RoxEvent for UserRoxEvent {
    type EventPayload = UserTopicEvent;

    fn key(&self) -> &str {
        &self.key
    }

    fn event(&self) -> &Event<Self::EventPayload> {
        &self.event
    }

    fn from_event(key: String, event: Event<Self::EventPayload>) -> Self {
        Self::with_event(key, event)
    }
}
