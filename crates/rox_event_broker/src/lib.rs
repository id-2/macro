#![deny(missing_docs)]
//! Event broker that publishes events to Kafka via a ports-and-adapters design.
//!
//! The [`domain`] layer defines typed event envelopes, per-topic
//! [`TopicEvent`](domain::models::TopicEvent) enums, the
//! [`RoxEvent`](domain::models::RoxEvent) event abstraction, the inbound
//! [`RoxEventBroker`](domain::ports::RoxEventBroker) API, the outbound
//! [`EventPublisher`](domain::ports::EventPublisher) and
//! [`Spawner`](domain::ports::Spawner) ports, the producing
//! [`RoxEventBrokerService`](domain::service::RoxEventBrokerService), and the
//! typed [`RoxEventConsumerService`](domain::service::RoxEventConsumerService),
//! which receives messages through the [`EventConsumer`](domain::ports::EventConsumer) port.
//! Kafka topic definitions live in the `rox_event_topics` crate. Shared Kafka
//! producer and consumer transports live in `kafka_util`, while the [`outbound`]
//! layer provides Kafka and Tokio adapters for the domain ports.

/// Domain layer: models, ports, and service.
pub mod domain;

pub use agent_correlation::AgentVerb;
#[doc(hidden)]
pub use uuid::Uuid as EventUuid;

pub use domain::models::{Event, EventBrokerError, RoxEvent, MessageWrapper, TopicEvent};
pub use rox_event_topics::{
    RoxChannelsTopic, RoxDocumentsTopic, RoxEmailTopic, RoxExampleTopic,
    RoxProjectsTopic, Topic,
};

pub use domain::ports::{
    EventConsumer, EventPublisher, RoxEventBroker, RoxEventCollection, MessageParts, Spawner,
};
pub use domain::service::{
    RoxEventBrokerService, RoxEventConsumerService, NoopRoxEventBroker,
};
#[cfg(feature = "outbound")]
pub use outbound::{
    kafka_event_consumer::KafkaConsumerAdapter, kafka_event_publisher::KafkaEventPublisher,
    spawner::GlobalSpawner,
};

/// Outbound adapters for the macro event broker's required ports.
#[cfg(feature = "outbound")]
pub mod outbound;
