use ::axum::{
    extract::FromRef,
    http::{HeaderMap, StatusCode, request::Parts},
};
use rootcause::Report;

use crate::{
    CredentialOrigin, RoxAuthorizationError, RoxAuthorizationService, RoxUserAuthentication,
};

use super::{
    RoxAuthorizationRejection, RoxAuthorizationState, authenticated_user,
    log_authorization_failure, rejection, status_rejection,
};

/// Header carrying a user API key.
pub const USER_API_KEY_HEADER: &str = "x-rox-user-api-key";

pub(super) async fn authorize_user_api_key_request<S, Svc>(
    parts: &Parts,
    state: &S,
) -> Result<RoxUserAuthentication, RoxAuthorizationRejection>
where
    RoxAuthorizationState<Svc>: FromRef<S>,
    Svc: RoxAuthorizationService,
{
    let api_key = user_api_key(&parts.headers)?;
    let authorization = RoxAuthorizationState::<Svc>::from_ref(state);
    let authorized = authorization
        .service
        .authorize_user_api_key(&api_key)
        .await
        .map_err(user_api_key_authorization_rejection)?;

    let origin = match authorized.account_manager {
        Some(credential) => CredentialOrigin::AccountManager(credential),
        None => CredentialOrigin::UserApiKey,
    };

    authenticated_user(authorized.user_context, origin)
}

fn user_api_key(headers: &HeaderMap) -> Result<String, RoxAuthorizationRejection> {
    let header = headers
        .get(USER_API_KEY_HEADER)
        .ok_or_else(|| rejection("unauthorized"))?;
    let key = header.to_str().map_err(|_| rejection("unauthorized"))?;
    if key.trim().is_empty() {
        return Err(rejection("unauthorized"));
    }

    Ok(key.to_owned())
}

fn user_api_key_authorization_rejection(
    error: Report<RoxAuthorizationError>,
) -> RoxAuthorizationRejection {
    let rejection = match error.current_context() {
        RoxAuthorizationError::CredentialsExpired
        | RoxAuthorizationError::InvalidCredentials
        | RoxAuthorizationError::ActingUserNotAuthorized
        | RoxAuthorizationError::BotScopeNotAuthorized => rejection("unauthorized"),
        RoxAuthorizationError::Unavailable => {
            status_rejection(StatusCode::INTERNAL_SERVER_ERROR, "internal server error")
        }
    };
    log_authorization_failure(&error, "user api key authorization failed");
    rejection
}
