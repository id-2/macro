#[cfg(test)]
mod test;

use ::rox_auth::{
    error::RoxAuthError,
    middleware::decode_jwt::{self, JwtToken, JwtValidationArgs},
};
use rootcause::Report;
use tracing::Level;

use crate::domain::{
    models::{CredentialOrigin, RoxAuthorizationError, ValidatedCredential, ValidatedIdentity},
    ports::JwtValidator,
};

/// JWT validator backed by the shared `rox_auth` validation implementation.
///
/// The adapter delegates all cryptographic and claims validation to
/// [`decode_jwt::handler`] and converts validated token claims into the
/// authorization domain model.
#[derive(Clone)]
pub struct RoxAuthJwtValidator {
    jwt_validation_args: JwtValidationArgs,
}

impl RoxAuthJwtValidator {
    /// Create a validator with resolved Rox authentication configuration.
    pub fn new(jwt_validation_args: JwtValidationArgs) -> Self {
        Self {
            jwt_validation_args,
        }
    }
}

impl JwtValidator for RoxAuthJwtValidator {
    #[tracing::instrument(err(level = Level::DEBUG), skip(self, jwt))]
    fn validate_credential(
        &self,
        jwt: &str,
    ) -> Result<ValidatedCredential, Report<RoxAuthorizationError>> {
        decode_jwt::handler(&self.jwt_validation_args, jwt)
            .map(identity_from_token)
            .map_err(validation_error)
    }
}

fn identity_from_token(token: JwtToken) -> ValidatedCredential {
    let origin = match &token {
        JwtToken::RoxAccessToken(_) => CredentialOrigin::Session,
        JwtToken::RoxApiToken(token) if token.agent_scope.is_some() => {
            CredentialOrigin::ScopedMacroApiJwt
        }
        JwtToken::RoxApiToken(_) => CredentialOrigin::RoxApiJwt,
    };
    let (user_id, fusion_user_id, organization_id, agent_id, agent_via) = match token {
        JwtToken::RoxAccessToken(token) => (
            token.rox_user_id,
            token.root_rox_id.unwrap_or(token.fusion_user_id),
            token.rox_organization_id,
            None,
            None,
        ),
        JwtToken::RoxApiToken(token) => (
            token.rox_user_id,
            token.fusion_user_id,
            token.rox_organization_id,
            token.agent_id.map(bot_id::BotId::new_from_uuid),
            token.agent_id.and(token.agent_via),
        ),
    };

    ValidatedCredential {
        origin,
        identity: ValidatedIdentity {
            agent_id,
            agent_via,
            user_id,
            fusion_user_id,
            organization_id,
            permissions: None,
        },
    }
}

fn validation_error(error: RoxAuthError) -> Report<RoxAuthorizationError> {
    let authorization_error = match &error {
        RoxAuthError::JwtExpired => RoxAuthorizationError::CredentialsExpired,
        _ => RoxAuthorizationError::InvalidCredentials,
    };

    Report::new(error).context(authorization_error)
}
