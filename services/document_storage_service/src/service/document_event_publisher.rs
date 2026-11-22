#[cfg(test)]
mod test;

use documents_hex::domain::events::{DocumentMacroEvent, DocumentPurgedMetadata};
use rox_event_broker::{EventBrokerError, RoxEventBroker};

/// Schedules a document-purged event for asynchronous broker delivery.
#[tracing::instrument(skip(event_broker), err)]
pub(crate) fn publish_document_purged_event<B: RoxEventBroker>(
    event_broker: &B,
    document_id: &str,
) -> Result<(), EventBrokerError> {
    let document_id = document_id.to_owned();
    let event =
        DocumentMacroEvent::purged(document_id.clone(), DocumentPurgedMetadata { document_id });

    drop(event_broker.send_event(&event)?);
    Ok(())
}
