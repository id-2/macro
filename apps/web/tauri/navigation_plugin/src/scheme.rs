use std::ops::Deref;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use url::Url;

/// The app's custom URL scheme: `rox://` is the primary scheme and `macro://`
/// is the pre-rebrand scheme still accepted from links already sent out.
pub const APP_SCHEME: &str = "rox";
pub const LEGACY_APP_SCHEME: &str = "macro";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
#[non_exhaustive]
pub struct RoxScheme(pub Url);

impl RoxScheme {
    pub fn new(url: Url) -> Result<Self, SchemeError> {
        if !matches!(url.scheme(), APP_SCHEME | LEGACY_APP_SCHEME) {
            return Err(SchemeError::InvalidScheme {
                expected: format!("{APP_SCHEME} or {LEGACY_APP_SCHEME}"),
                found: url.scheme().to_string(),
            });
        }
        Ok(Self(url))
    }
    /// turn a http(s) url into a rox scheme url
    #[tracing::instrument(skip(url), err)]
    pub fn from_url(url: &Url) -> Result<Self, SchemeError> {
        let ("http" | "https" | "tauri") = url.scheme() else {
            return Err(SchemeError::InvalidScheme {
                expected: "http(s) or tauri".to_string(),
                found: url.scheme().to_string(),
            });
        };

        // A webview URL carries its route in the fragment (`tauri://localhost/#/mail`).
        // Any other fragment belongs to the route, like a booking receipt's token.
        let (route, fragment) = match url.fragment() {
            Some(route) if route.starts_with('/') => route
                .split_once('#')
                .map_or((route, None), |(route, fragment)| (route, Some(fragment))),
            fragment => (url.path(), fragment),
        };
        let mut rest = route.trim_start_matches('/');
        // Mobile router uses '/' as base, so strip the 'app' prefix from universal links
        if let Some(stripped) = rest.strip_prefix("app/") {
            rest = stripped;
        } else if rest == "app" {
            rest = "";
        }
        let query = url.query();
        let mut inner = match query {
            Some(q) => format!("{APP_SCHEME}:///{rest}?{q}"),
            None => format!("{APP_SCHEME}:///{rest}"),
        }
        .parse::<Url>()?;
        inner.set_fragment(fragment);
        Ok(RoxScheme(inner))
    }
}

impl AsRef<str> for RoxScheme {
    fn as_ref(&self) -> &str {
        self.0.as_str()
    }
}

impl Deref for RoxScheme {
    type Target = Url;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug, Error)]
pub enum SchemeError {
    #[error("The input url did not have a fragment")]
    MissingPathOrFragment,
    #[error("{0}")]
    Parse(#[from] url::ParseError),
    #[error("Invalid scheme received. Expected {expected}, found {found}")]
    InvalidScheme { expected: String, found: String },
}
