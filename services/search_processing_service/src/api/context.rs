use axum::extract::FromRef;
use rox_authorization::{
    RoxAuthorizationServiceImpl, RoxAuthorizationState, NoopMacroAuthJwtValidator,
};
use rox_event_broker::{KafkaEventPublisher, RoxEventBrokerService};
use std::sync::Arc;
use tokio_util::task::TaskTracker;

use crate::BackfillServiceImpl;
use crate::config::Config;
use crate::domain::jobs::BackfillJobs;

pub(crate) type AuthorizationService = RoxAuthorizationServiceImpl<NoopMacroAuthJwtValidator>;
pub(crate) type SpsEventBroker = RoxEventBrokerService<KafkaEventPublisher, TaskTracker>;

#[derive(Clone, FromRef)]
pub(crate) struct ApiContext {
    pub agent_session_indexer: Arc<crate::AgentSessionIndexer>,
    pub db: sqlx::Pool<sqlx::Postgres>,
    pub opensearch_client: Arc<opensearch_client::OpensearchClient>,
    pub authorization_state: RoxAuthorizationState<AuthorizationService>,
    pub config: Arc<Config>,
    pub backfill_service: Arc<BackfillServiceImpl>,
    pub backfill_jobs: BackfillJobs,
    pub rox_event_broker: SpsEventBroker,
}
