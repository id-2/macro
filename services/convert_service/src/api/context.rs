use axum::extract::FromRef;
use rox_authorization::{
    RoxAuthorizationServiceImpl, RoxAuthorizationState, NoopRoxAuthJwtValidator,
};
use s3_client::S3;
use std::sync::Arc;

use crate::config::Config;

pub(crate) type AuthorizationService = RoxAuthorizationServiceImpl<NoopRoxAuthJwtValidator>;

#[derive(Clone, FromRef)]
pub struct ApiContext {
    pub db: sqlx::PgPool,
    pub s3_client: S3,
    pub sqs_client: Arc<sqs_client::SQS>,
    pub authorization_state: RoxAuthorizationState<AuthorizationService>,
    pub config: Arc<Config>,
}
