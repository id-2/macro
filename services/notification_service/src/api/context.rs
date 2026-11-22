use crate::config::Config;
use axum::extract::FromRef;
use rox_auth::InternalApiKey;
use rox_authorization::{
    RoxAuthJwtValidator, RoxAuthorizationServiceImpl, RoxAuthorizationState,
};
use sqlx::PgPool;
use std::sync::Arc;

pub(crate) type AuthorizationService = RoxAuthorizationServiceImpl<RoxAuthJwtValidator>;
pub(crate) type ItemPreferences =
    notification::domain::item_preferences::ItemNotificationPreferenceService<
        notification::outbound::item_preferences::PgItemNotificationPreferenceRepository,
    >;

#[derive(Clone, FromRef)]
pub struct ApiContext {
    /// Signed invocation validation and propagation.
    pub correlation: agent_correlation::inbound::CorrelationState,
    pub item_preferences: ItemPreferences,
    pub db: PgPool,
    pub sns_client: Arc<sns_client::SNS>,
    pub config: Arc<Config>,
    pub authorization_state: RoxAuthorizationState<AuthorizationService>,
    pub internal_api_key: InternalApiKey,
}
