use std::marker::PhantomData;

use ::axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, request::Parts},
};

use rox_auth::credential::{CredentialKind, TokenSource};

use crate::{RoxAuthorization, RoxAuthorizationService};

use super::{
    AuthorizationPolicy, RoxAuthorizationRejection, RoxAuthorizationState,
    bot::authorize_optional_bot_request,
    harness::authorize_optional_harness_request,
    internal::{authorize_internal_request, internal_header_convention},
    rejection, status_rejection,
    user::{UserToken, authorize_optional_user_request},
    user_api_key::authorize_user_api_key_request,
};

/// Extracts and authorizes the request principal, then narrows it with `Policy`.
#[non_exhaustive]
pub struct RoxAuthorizationExtractor<Svc, Policy: AuthorizationPolicy> {
    /// The policy-narrowed authorization established for the request.
    pub authorization: Policy::Output,
    _service: PhantomData<fn() -> Svc>,
}

impl<Svc, Policy: AuthorizationPolicy> RoxAuthorizationExtractor<Svc, Policy> {
    /// Return the authenticated entity responsible for this request.
    pub fn acting_entity(&self) -> Policy::ActingEntity<'_> {
        Policy::acting_entity(&self.authorization)
    }
}

impl<Svc, Policy: AuthorizationPolicy> Clone for RoxAuthorizationExtractor<Svc, Policy> {
    fn clone(&self) -> Self {
        Self {
            authorization: self.authorization.clone(),
            _service: PhantomData,
        }
    }
}

impl<S, Svc, Policy> FromRequestParts<S> for RoxAuthorizationExtractor<Svc, Policy>
where
    RoxAuthorizationState<Svc>: FromRef<S>,
    Svc: RoxAuthorizationService,
    Policy: AuthorizationPolicy,
    S: Send + Sync + 'static,
{
    type Rejection = RoxAuthorizationRejection;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let authorization = authorize_request::<S, Svc>(parts, state)
            .await?
            .ok_or_else(|| rejection("unauthorized"))?;

        Ok(Self {
            authorization: Policy::narrow(authorization)?,
            _service: PhantomData,
        })
    }
}

pub(super) async fn authorize_request<S, Svc>(
    parts: &mut Parts,
    state: &S,
) -> Result<Option<RoxAuthorization>, RoxAuthorizationRejection>
where
    RoxAuthorizationState<Svc>: FromRef<S>,
    Svc: RoxAuthorizationService,
    S: Send + Sync + 'static,
{
    // The one reading of the request's credential, shared with the agent
    // scope check, so the two can't pick different ones.
    let credential = rox_auth::credential::request_credential(parts)
        .map_err(|error| status_rejection(StatusCode::BAD_REQUEST, error.code()))?;
    let user_token = match credential.kind {
        CredentialKind::Internal => {
            let Some(convention) = internal_header_convention(&parts.headers) else {
                return Err(rejection("unauthorized"));
            };
            return authorize_internal_request::<S, Svc>(parts, state, convention).await;
        }
        CredentialKind::UserApiKey => {
            let user = authorize_user_api_key_request::<S, Svc>(parts, state).await?;
            return Ok(Some(RoxAuthorization::User(user)));
        }
        CredentialKind::Bot => {
            let bot = authorize_optional_bot_request::<S, Svc>(parts, state)
                .await?
                .ok_or_else(|| rejection("unauthorized"))?;
            return Ok(Some(RoxAuthorization::Bot(bot)));
        }
        CredentialKind::Harness => {
            let harness = authorize_optional_harness_request::<S, Svc>(parts, state)
                .await?
                .ok_or_else(|| rejection("unauthorized"))?;
            return Ok(Some(RoxAuthorization::Harness(harness)));
        }
        CredentialKind::MalformedAuthorization => return Err(rejection("unauthorized")),
        CredentialKind::UserToken { token, source } => Some(UserToken {
            token,
            explicit: source != TokenSource::Cookie,
        }),
        CredentialKind::None => None,
    };

    authorize_optional_user_request::<S, Svc>(state, user_token)
        .await
        .map(|user| user.map(RoxAuthorization::User))
}
