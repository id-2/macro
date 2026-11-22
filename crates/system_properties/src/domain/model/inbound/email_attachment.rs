//! Email attachment property types.

use super::source_entity::SourceEntity;
use rox_user_id::lowercased::Lowercase;
use rox_user_id::user_id::RoxUserId;

/// Email attachment properties to set on an entity.
#[derive(Debug, Clone, Default)]
pub struct EmailAttachmentProperty<'a> {
    /// Source entity reference (single).
    pub source: Option<SourceEntity>,
    /// Company entity IDs.
    pub companies: Option<Vec<String>>,
    /// Sender user ID.
    pub sender: Option<RoxUserId<Lowercase<'a>>>,
    /// Recipient user IDs.
    pub recipients: Option<Vec<RoxUserId<Lowercase<'a>>>>,
    /// Subject line.
    pub subject: Option<String>,
}

/// Input for bulk email attachment property setting.
#[derive(Debug, Clone)]
pub struct EmailAttachmentInput<'a> {
    /// The entity ID to set properties on.
    pub entity_id: String,
    /// The properties to set.
    pub properties: EmailAttachmentProperty<'a>,
}
