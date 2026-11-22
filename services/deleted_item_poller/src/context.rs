use std::sync::Arc;

use rox_event_broker::{GlobalSpawner, KafkaEventPublisher, RoxEventBrokerService};

pub type PollerEventBroker = RoxEventBrokerService<KafkaEventPublisher, GlobalSpawner>;

#[derive(Clone)]
pub struct Context {
    pub db: sqlx::Pool<sqlx::Postgres>,
    pub rox_event_broker: PollerEventBroker,
    pub sqs_client: Arc<sqs_client::SQS>,
}
