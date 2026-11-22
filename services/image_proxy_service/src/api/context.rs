use axum::extract::FromRef;
use rox_auth::middleware::decode_jwt::JwtValidationArgs;
use rox_authorization::{
    RoxAuthJwtValidator, RoxAuthorizationServiceImpl, RoxAuthorizationState,
};
use rox_env::Environment;

pub type AuthorizationService = RoxAuthorizationServiceImpl<RoxAuthJwtValidator>;

#[derive(Clone, FromRef)]
pub struct ApiContext {
    pub logo_service: crate::domain::LogoService<crate::outbound::FaviconProvider>,
    pub authorization_state: RoxAuthorizationState<AuthorizationService>,
    pub environment: Environment,
    pub http_client: reqwest::Client,
    /// Verifies the signed scope of an agent run's credential.
    pub jwt_validation_args: JwtValidationArgs,
}
