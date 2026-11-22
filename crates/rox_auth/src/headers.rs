use std::sync::LazyLock;

use axum::{RequestPartsExt, extract::FromRequestParts, http::StatusCode};
use axum_extra::{
    TypedHeader,
    either::Either,
    extract::CookieJar,
    headers::{Authorization, authorization::Bearer},
};
use cookie::Cookie;

use crate::constant::{
    ROX_REFRESH_TOKEN_HEADER, access_token_cookie_names, refresh_token_cookie_names,
};

/// Extracts the access token from a cookie. Returns `UNAUTHORIZED` if the cookie is missing.
///
/// Reads the current `rox-access-token` name first and falls back to the legacy
/// `macro-access-token` name, so a session signed in before the rename keeps
/// working until its next token rotation writes the current name.
pub struct AccessTokenCookieExtractor(pub Cookie<'static>);

impl<S> FromRequestParts<S> for AccessTokenCookieExtractor
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let jar: CookieJar = parts.extract().await.expect("This extractor is infallible");
        static ACCESS_COOKIE_NAMES: LazyLock<[String; 2]> =
            LazyLock::new(access_token_cookie_names);

        ACCESS_COOKIE_NAMES
            .iter()
            .find_map(|name| jar.get(name).cloned())
            .map(Self)
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}
/// Extracts the refresh token from a cookie. Returns `UNAUTHORIZED` if the cookie is missing.
///
/// Accepts the legacy `macro-refresh-token` name alongside the current
/// `rox-refresh-token`, mirroring the access token extractor.
pub struct RefreshTokenCookieExtractor(pub Cookie<'static>);

impl<S> FromRequestParts<S> for RefreshTokenCookieExtractor
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let jar: CookieJar = parts.extract().await.expect("This extractor is infallible");
        static REFRESH_COOKIE_NAMES: LazyLock<[String; 2]> =
            LazyLock::new(refresh_token_cookie_names);

        REFRESH_COOKIE_NAMES
            .iter()
            .find_map(|name| jar.get(name).cloned())
            .map(Self)
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

/// Extracts the access token from either the `Authorization: Bearer` header or a cookie.
/// Returns `UNAUTHORIZED` if neither source provides a token.
pub enum AccessTokenExtractor {
    Header(TypedHeader<Authorization<Bearer>>),
    Cookie(AccessTokenCookieExtractor),
}

impl AsRef<str> for AccessTokenExtractor {
    fn as_ref(&self) -> &str {
        match self {
            AccessTokenExtractor::Header(typed_header) => typed_header.token(),
            AccessTokenExtractor::Cookie(access_token_cookie_extractor) => {
                access_token_cookie_extractor.0.value_trimmed()
            }
        }
    }
}

impl<S> FromRequestParts<S> for AccessTokenExtractor
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let either: Either<TypedHeader<Authorization<Bearer>>, AccessTokenCookieExtractor> =
            parts.extract().await?;
        Ok(match either {
            Either::E1(l) => Self::Header(l),
            Either::E2(r) => Self::Cookie(r),
        })
    }
}

/// Extracts the refresh token from a custom header. Returns `BAD_REQUEST` if the header is missing.
pub struct RefreshTokenHeaderExtractor(pub String);

impl<S> FromRequestParts<S> for RefreshTokenHeaderExtractor
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let Some(header) = parts
            .headers
            .get(ROX_REFRESH_TOKEN_HEADER)
            .and_then(|h| h.to_str().ok())
        else {
            return Err(StatusCode::BAD_REQUEST);
        };
        Ok(Self(header.to_string()))
    }
}

/// Extracts the refresh token from either a custom header or a cookie.
/// Returns `UNAUTHORIZED` if neither source provides a token.
pub enum RefreshTokenExtractor {
    Header(RefreshTokenHeaderExtractor),
    Cookie(RefreshTokenCookieExtractor),
}

impl AsRef<str> for RefreshTokenExtractor {
    fn as_ref(&self) -> &str {
        match self {
            RefreshTokenExtractor::Header(refresh_token_header_extractor) => {
                &refresh_token_header_extractor.0
            }
            RefreshTokenExtractor::Cookie(refresh_token_cookie_extractor) => {
                refresh_token_cookie_extractor.0.value_trimmed()
            }
        }
    }
}

impl<S> FromRequestParts<S> for RefreshTokenExtractor
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let either: Either<RefreshTokenHeaderExtractor, RefreshTokenCookieExtractor> =
            parts.extract().await?;
        Ok(match either {
            Either::E1(l) => Self::Header(l),
            Either::E2(r) => Self::Cookie(r),
        })
    }
}
