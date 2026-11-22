use rox_event_broker::{
    EventBrokerError, RoxEventCollection as _, MessageParts, MessageWrapper,
};

use super::DeclaredMacroEvent;

struct TestMessage {
    payload: Vec<u8>,
}

impl MessageParts for TestMessage {
    fn key(&self) -> Option<&str> {
        Some("rox|user@example.com")
    }

    fn payload(&self) -> Option<&[u8]> {
        Some(&self.payload)
    }

    fn topic(&self) -> &str {
        "rox.soup"
    }
}

#[test]
fn assigns_only_the_typed_soup_topic() {
    assert_eq!(DeclaredMacroEvent::topics(), ["rox.soup"]);
}

#[test]
fn declared_topic_decoder_rejects_unsupported_schema_versions() {
    let message = MessageWrapper::<_, DeclaredMacroEvent>::new(TestMessage {
        payload: serde_json::to_vec(&serde_json::json!({
            "event_id": "00000000-0000-0000-0000-000000000001",
            "schema_version": 1,
            "event_type": "soup.updated",
            "metadata": [
                "rox|user@example.com",
                {
                    "entity_type": "document",
                    "entity_id": "00000000-0000-0000-0000-000000000001"
                }
            ]
        }))
        .expect("serializable event"),
    });

    assert!(matches!(
        message.decode_payload(),
        Err(EventBrokerError::UnsupportedSchemaVersion {
            expected: 2,
            actual: 1,
            ..
        })
    ));
}
