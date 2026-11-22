//! Who a git request comes from.

use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header, request::Parts},
    response::{IntoResponse, Response},
};
use axum_extra::headers::{Authorization, HeaderMapExt, authorization::Basic};
use rox_authorization::{
    RoxAuthorizationRejection, RoxAuthorizationService, RoxAuthorizationState,
    OptionalMacroAuthorizationExtractor, UserOnly,
};

use crate::domain::models::{GitCredential, RepoToken};

/// Realm git shows when it asks for credentials.
pub(crate) const BASIC_CHALLENGE: &str = "Basic realm=\"Rox agent workspace\"";

/// HTTP Basic (password = repo token, username ignored), else a Rox user
/// credential (session cookie, bearer JWT, or `x-rox-user-api-key`).
pub struct GitCredentialExtractor<Auth> {
    /// The caller.
    pub credential: GitCredential,
    _authorization: std::marker::PhantomData<fn() -> Auth>,
}

/// Why no credential was established.
pub enum GitCredentialRejection {
    /// Nothing presented: challenge so git asks for credentials.
    Missing,
    /// A Rox credential failed.
    Rox(RoxAuthorizationRejection),
}

impl IntoResponse for GitCredentialRejection {
    fn into_response(self) -> Response {
        match self {
            GitCredentialRejection::Missing => (
                StatusCode::UNAUTHORIZED,
                [(header::WWW_AUTHENTICATE, BASIC_CHALLENGE)],
                "authentication required\n",
            )
                .into_response(),
            GitCredentialRejection::Rox(rejection) => rejection.into_response(),
        }
    }
}

impl<State, Auth> FromRequestParts<State> for GitCredentialExtractor<Auth>
where
    RoxAuthorizationState<Auth>: FromRef<State>,
    Auth: RoxAuthorizationService,
    State: Send + Sync + 'static,
{
    type Rejection = GitCredentialRejection;

    async fn from_request_parts(parts: &mut Parts, state: &State) -> Result<Self, Self::Rejection> {
        if let Some(Authorization(basic)) = parts.headers.typed_get::<Authorization<Basic>>() {
            return Ok(Self {
                credential: GitCredential::RepoToken(
                    RepoToken::parse(basic.password().to_owned())
                        .map_err(|_| GitCredentialRejection::Missing)?,
                ),
                _authorization: std::marker::PhantomData,
            });
        }

        let user =
            OptionalMacroAuthorizationExtractor::<Auth, UserOnly>::from_request_parts(parts, state)
                .await
                .map_err(GitCredentialRejection::Rox)?
                .authorization
                .ok_or(GitCredentialRejection::Missing)?;

        Ok(Self {
            credential: GitCredential::User(user.rox_user_id),
            _authorization: std::marker::PhantomData,
        })
    }
}
