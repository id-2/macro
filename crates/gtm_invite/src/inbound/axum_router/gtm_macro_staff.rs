//! Extractor that admits only authenticated Rox staff.

use std::marker::PhantomData;

use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
    response::{IntoResponse, Response},
};
use rox_authorization::{
    RoxAuthorizationExtractor, RoxAuthorizationRejection, RoxAuthorizationService,
    RoxAuthorizationState, UserOrInternal,
};
use rox_user_id::user_id::RoxUserIdStr;

use crate::domain::models::GtmInviteError;

/// Authenticated Rox staff principal for GTM invite staff endpoints.
pub struct GtmRoxStaffExtractor<Auth> {
    /// The authenticated staff user's id.
    pub macro_user_id: RoxUserIdStr<'static>,
    _auth: PhantomData<fn() -> Auth>,
}

/// Rejection returned when the Rox staff check fails.
#[derive(Debug, thiserror::Error)]
pub enum GtmRoxStaffRejection {
    /// The request could not be authorized.
    #[error("authorization failed")]
    Authorization(#[from] RoxAuthorizationRejection),
    /// The authenticated user is not Rox staff.
    #[error("only Rox staff can manage invite links")]
    NotStaff,
}

impl IntoResponse for GtmRoxStaffRejection {
    fn into_response(self) -> Response {
        match self {
            Self::Authorization(rejection) => rejection.into_response(),
            Self::NotStaff => GtmInviteError::Forbidden.into_response(),
        }
    }
}

impl<S, Auth> FromRequestParts<S> for GtmRoxStaffExtractor<Auth>
where
    RoxAuthorizationState<Auth>: FromRef<S>,
    Auth: RoxAuthorizationService,
    S: Send + Sync + 'static,
{
    type Rejection = GtmRoxStaffRejection;

    #[tracing::instrument(err, skip(parts, state))]
    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let authorization =
            RoxAuthorizationExtractor::<Auth, UserOrInternal>::from_request_parts(parts, state)
                .await?;
        let macro_user_id = authorization.authorization.user.macro_user_id;
        if !macro_user_id.is_macro_staff() {
            return Err(GtmRoxStaffRejection::NotStaff);
        }

        Ok(Self {
            macro_user_id,
            _auth: PhantomData,
        })
    }
}
