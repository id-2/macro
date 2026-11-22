//! The broker topics the webhook system subscribes to.
//!
//! One declaration shared by both consumption paths — the durable ingestion
//! consumer (`inbound::kafka_consumer`) and the process-level SSE consumer
//! (`inbound::kafka_stream_consumer`) — so the two can never drift onto
//! different topic sets.

use crate::domain::events::WebhookRoxEvent;
use agent_session::domain::events::AgentSessionLifecycleRoxEvent;
use agent_trigger::domain::broker_events::AgentSessionRoxEvent;
use call::domain::notification_events::CallNotificationRoxEvent;
use channels::domain::broker_events::ChannelRoxEvent;
use documents::domain::events::DocumentRoxEvent;
use messages::outbound::broker::MessageRoxEvent;
use password_events::PasswordRoxEvent;
use user_events::UserRoxEvent;

rox_event_broker::declare_topics!(
    DeclaredRoxEvent: DocumentRoxEvent,
    ChannelRoxEvent,
    CallNotificationRoxEvent,
    MessageRoxEvent,
    WebhookRoxEvent,
    AgentSessionRoxEvent,
    AgentSessionLifecycleRoxEvent,
    UserRoxEvent,
    PasswordRoxEvent,
);
