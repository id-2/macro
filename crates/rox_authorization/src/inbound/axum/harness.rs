use ::axum::{
    extract::FromRef,
    http::{HeaderMap, StatusCode, request::Parts},
};
use rootcause::Report;

use crate::{HarnessAuthentication, RoxAuthorizationError, RoxAuthorizationService};

use super::{
    RoxAuthorizationRejection, RoxAuthorizationState, bot::header_value, log_authorization_failure,
    rejection, status_rejection,
};

/// Header carrying a harness authentication token.
pub use rox_auth::credential::HARNESS_TOKEN_HEADER;
/// Header carrying the Rox user ID a harness claims to act for.
pub const HARNESS_FOR_MACRO_USER_ID_HEADER: &str = "x-rox-harness-for-rox-user-id";

/// The harness token header clients sent before the rename; accepted with no
/// expiry.
pub use rox_auth::credential::LEGACY_HARNESS_TOKEN_HEADER;
/// The acting-user claim header clients sent before the rename.
pub const LEGACY_HARNESS_FOR_MACRO_USER_ID_HEADER: &str = "x-macro-harness-for-macro-user-id";

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
    let found = header_value(headers, HARNESS_TOKEN_HEADER, LEGACY_HARNESS_TOKEN_HEADER);
    let Some(header) = found else {
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
    let claim = header_value(
        headers,
        HARNESS_FOR_MACRO_USER_ID_HEADER,
        LEGACY_HARNESS_FOR_MACRO_USER_ID_HEADER,
    );
    claim
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
