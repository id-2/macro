#[derive(thiserror::Error, Debug, serde::Serialize)]
#[serde(tag = "type")]
pub enum RoxAuthError {
    #[error("invalid Authorization header format")]
    InvalidAuthorizationHeaderFormat,
    #[error("no access token provided")]
    NoAccessTokenProvided,
    #[error("no refresh token provided")]
    NoRefreshTokenProvided,
    #[error("jwt validation failed: {details}")]
    JwtValidationFailed { details: String },
    #[error("jwt is expired")]
    JwtExpired,
    #[error("an unknown error occurred")]
    Generic(GenericErrorResponse),
}

#[derive(serde::Serialize, Debug)]
pub struct GenericErrorResponse {
    pub message: String,
}

impl From<anyhow::Error> for GenericErrorResponse {
    fn from(err: anyhow::Error) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

impl From<anyhow::Error> for RoxAuthError {
    fn from(err: anyhow::Error) -> Self {
        RoxAuthError::Generic(GenericErrorResponse::from(err))
    }
}
