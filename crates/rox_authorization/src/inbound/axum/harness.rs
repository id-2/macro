use ::axum::{
    extract::FromRef,
    http::{HeaderMap, StatusCode, request::Parts},
};
use rootcause::Report;

use crate::{HarnessAuthentication, RoxAuthorizationError, RoxAuthorizationService};

use super::{
    RoxAuthorizationRejection, RoxAuthorizationState, log_authorization_failure, rejection,
    status_rejection,
};

/// Header carrying a harness authentication token.
pub const HARNESS_TOKEN_HEADER: &str = "x-rox-harness-token";
/// Header carrying the Rox user ID a harness claims to act for.
pub const HARNESS_FOR_ROX_USER_ID_HEADER: &str = "x-rox-harness-for-macro-user-id";

pub(super) async fn authorize_optional_harness_request<S, Svc>(
    parts: &Parts,
    state: &S,
) -> Result<Option<HarnessAuthentication>, RoxAuthorizationRejection>
where
    RoxAuthorizationState<Svc>: FromRef<S>,
    Svc: RoxAuthorizationService,
{
    let Some(token) = harness_token(&parts.headers)? else {
        return Ok(None);
    };
    let claim = harness_acting_user_claim(&parts.headers)?;
    let authorization = RoxAuthorizationState::<Svc>::from_ref(state);
    let harness = authorization
        .service
        .authorize_harness(&token, claim)
        .await
        .map_err(harness_authorization_rejection)?;

    Ok(Some(harness))
}

fn harness_token(headers: &HeaderMap) -> Result<Option<String>, RoxAuthorizationRejection> {
    let Some(header) = headers.get(HARNESS_TOKEN_HEADER) else {
        return Ok(None);
    };
    let token = header.to_str().map_err(|_| rejection("unauthorized"))?;
    if token.trim().is_empty() {
        return Err(rejection("unauthorized"));
    }

    Ok(Some(token.to_owned()))
}

fn harness_acting_user_claim(
    headers: &HeaderMap,
) -> Result<Option<String>, RoxAuthorizationRejection> {
    headers
        .get(HARNESS_FOR_ROX_USER_ID_HEADER)
        .map(|header| {
            header
                .to_str()
                .map(str::to_owned)
                .map_err(|_| status_rejection(StatusCode::BAD_REQUEST, "invalid harness claims"))
        })
        .transpose()
}

fn harness_authorization_rejection(
    error: Report<RoxAuthorizationError>,
) -> RoxAuthorizationRejection {
    let rejection = match error.current_context() {
        RoxAuthorizationError::CredentialsExpired
        | RoxAuthorizationError::InvalidCredentials => rejection("unauthorized"),
        RoxAuthorizationError::ActingUserNotAuthorized
        | RoxAuthorizationError::BotScopeNotAuthorized => {
            status_rejection(StatusCode::FORBIDDEN, "forbidden")
        }
        RoxAuthorizationError::Unavailable => {
            status_rejection(StatusCode::INTERNAL_SERVER_ERROR, "internal server error")
        }
    };
    log_authorization_failure(&error, "harness authorization failed");
    rejection
}
