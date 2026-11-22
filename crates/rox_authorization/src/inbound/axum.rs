#[cfg(test)]
mod test;

mod bot;
mod harness;
mod internal;
mod rox_authorization;
mod optional;
mod policy;
mod program;
mod user;
mod user_api_key;

use std::{borrow::Cow, fmt, sync::Arc};

use ::axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use bot_id::BotId;
use harness_id::HarnessId;
use rox_user_id::{cowlike::CowLike, user_id::RoxUserIdStr};
use model_error_response::ErrorResponse;
use model_user::UserContext;
use rootcause::Report;

use crate::{
    CredentialOrigin, RoxAuthorization, RoxAuthorizationError, RoxUserAuthentication,
};

pub use bot::{
    BOT_FOR_FUSIONAUTH_USER_ID_HEADER, BOT_FOR_ROX_USER_ID_HEADER,
    BOT_FOR_ORGANIZATION_ID_HEADER, BOT_SCOPE_HEADER, BOT_TOKEN_HEADER,
};
pub use harness::{HARNESS_FOR_ROX_USER_ID_HEADER, HARNESS_TOKEN_HEADER};
#[allow(deprecated)]
pub use internal::{
    INTERNAL_API_KEY_HEADER, INTERNAL_FUSIONAUTH_USER_ID_HEADER,
    INTERNAL_ROX_ORGANIZATION_ID_HEADER, INTERNAL_ROX_USER_ID_HEADER,
    LEGACY_DSS_INTERNAL_API_KEY_HEADER, LEGACY_DSS_INTERNAL_ROX_USER_ID_HEADER,
};
pub use rox_authorization::RoxAuthorizationExtractor;
pub use optional::OptionalMacroAuthorizationExtractor;
pub use policy::{
    AccountHolderOrInternal, ActingUser, ActingUserAuthorization, AnyPrincipal,
    AuthorizationPolicy, BotOnly, HarnessOnly, InternalAuthorization, InternalEntity, InternalOnly,
    UserBotOrHarness, UserBotOrHarnessAuthorization, UserBotOrHarnessEntity, UserOnly, UserOrBot,
    UserOrBotAuthorization, UserOrBotEntity, UserOrInternal, UserOrInternalAuthorization,
    UserOrInternalCaller, UserOrInternalEntity, UserOrInternalService,
    UserOrInternalServiceAuthorization,
};
pub use program::{CODE_EXECUTION_HEADER, is_agent_run};
pub use user_api_key::USER_API_KEY_HEADER;

/// The authenticated entity responsible for a request.
///
/// This intentionally identifies the authenticating principal rather than an
/// acting user. A bot acting for a user is attributed to the bot, and an
/// internal service acting for a user is attributed to the internal service.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ActingEntity<'a> {
    /// A directly authenticated bot.
    Bot(BotId),
    /// A directly authenticated harness.
    Harness(HarnessId),
    /// A directly authenticated Rox user.
    User(&'a str),
    /// An authenticated internal service.
    Internal,
}

impl<'a> From<&'a RoxAuthorization> for ActingEntity<'a> {
    fn from(authorization: &'a RoxAuthorization) -> Self {
        match authorization {
            RoxAuthorization::User(user) => Self::User(user.rox_user_id.as_ref()),
            RoxAuthorization::Bot(bot) => Self::Bot(bot.bot_id),
            RoxAuthorization::Harness(harness) => Self::Harness(harness.harness_id),
            RoxAuthorization::Internal(_) => Self::Internal,
        }
    }
}

impl fmt::Display for ActingEntity<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Bot(bot_id) => bot_id.fmt(formatter),
            Self::Harness(harness_id) => harness_id.fmt(formatter),
            Self::User(user_id) => formatter.write_str(user_id.as_ref()),
            Self::Internal => formatter.write_str("internal"),
        }
    }
}

/// Rejection returned when request credentials cannot authorize a user.
#[derive(Clone, Debug)]
pub struct RoxAuthorizationRejection {
    /// HTTP status returned to the client.
    pub status: StatusCode,
    /// Client-safe error message returned in the response body.
    pub message: Cow<'static, str>,
}

impl fmt::Display for RoxAuthorizationRejection {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for RoxAuthorizationRejection {}

impl IntoResponse for RoxAuthorizationRejection {
    fn into_response(self) -> Response {
        let Self { status, message } = self;
        (status, Json(ErrorResponse { message })).into_response()
    }
}

/// Axum state containing the service used by authorization extractors.
pub struct RoxAuthorizationState<Svc> {
    pub(super) service: Arc<Svc>,
}

impl<Svc> RoxAuthorizationState<Svc> {
    /// Create authorization state backed by the supplied service.
    pub fn new(service: Arc<Svc>) -> Self {
        Self { service }
    }
}

impl<Svc> Clone for RoxAuthorizationState<Svc> {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
        }
    }
}

pub(super) fn authenticated_user(
    user_context: UserContext,
    origin: CredentialOrigin,
) -> Result<RoxUserAuthentication, RoxAuthorizationRejection> {
    let rox_user_id = RoxUserIdStr::parse_from_str(&user_context.user_id)
        .map(CowLike::into_owned)
        .map_err(|error| {
            tracing::error!(error=?error, "authorized context contained invalid macro user id");
            rejection("invalid user id")
        })?;

    Ok(RoxUserAuthentication {
        origin,
        agent_id: None,
        agent_via: None,
        rox_user_id,
        user_context,
    })
}

/// Logs a failed authorization at a level matching its cause: rejected
/// credentials are routine client traffic, while an unavailable dependency is
/// a server fault.
pub(super) fn log_authorization_failure(
    error: &Report<RoxAuthorizationError>,
    message: &'static str,
) {
    match error.current_context() {
        RoxAuthorizationError::CredentialsExpired => tracing::info!(error=?error, "{message}"),
        RoxAuthorizationError::InvalidCredentials
        | RoxAuthorizationError::ActingUserNotAuthorized
        | RoxAuthorizationError::BotScopeNotAuthorized => {
            tracing::warn!(error=?error, "{message}")
        }
        RoxAuthorizationError::Unavailable => tracing::error!(error=?error, "{message}"),
    }
}

pub(super) fn rejection(message: &'static str) -> RoxAuthorizationRejection {
    status_rejection(StatusCode::UNAUTHORIZED, message)
}

pub(super) fn status_rejection(
    status: StatusCode,
    message: &'static str,
) -> RoxAuthorizationRejection {
    RoxAuthorizationRejection {
        status,
        message: message.into(),
    }
}
