use anyhow::Context;
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use github::domain::{
    models::{GithubError, GithubLinkStatus},
    ports::GithubLinkService,
};
use rox_authorization::{AccountHolderOrInternal, RoxAuthorizationExtractor};
use rox_middleware::tracking::ClientIp;
use model::response::{EmptyResponse, ErrorResponse};
use serde_utils::urlencode::UrlEncoded;
use upstream_error::{UpstreamError, UpstreamErrorResponse};
use url::Url;

use crate::{
    account_link_state::{AccountLinkState, LinkProvider, sign_account_link_state},
    api::context::{ApiContext, AuthorizationService},
};

#[cfg(test)]
mod test;

pub const REAUTHENTICATION_REQUIRED_MESSAGE: &str = "ReauthenticationRequired";

/// Stable code for the configuration gap that stops a GitHub link from starting.
pub const GITHUB_NOT_CONFIGURED_CODE: &str = "github_not_configured";

/// What to fix when FusionAuth has no `github` identity provider. The name of
/// the provider and both settings are spelled out: the generic failure this
/// replaces told neither the user nor an operator what was missing.
pub const GITHUB_NOT_CONFIGURED_MESSAGE: &str =
    "GitHub не подключён на этом стенде: в FusionAuth нет провайдера github. \
     Задайте настоящие GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET GitHub OAuth-приложения \
     в окружении authentication-service, перезапустите стенд и создайте провайдер github.";

/// The answer to a link start that cannot work in this deployment.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct GithubLinkNotConfiguredResponse {
    /// Stable machine-readable code for this configuration gap.
    pub code: String,
    /// What is missing and which settings fix it, written for the user.
    pub message: String,
    /// The callback URL the GitHub OAuth app must accept.
    pub redirect_uri: String,
    /// The service settings that are empty or still hold placeholders.
    pub missing_settings: Vec<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, utoipa::ToSchema)]
pub struct GithubLinkStatusResponse {
    /// Whether the user must reauthenticate their GitHub link.
    pub reauthentication_required: bool,
    /// Login of the authenticated user's linked GitHub account.
    pub github_username: String,
    /// Stable ID of the authenticated user's linked GitHub account.
    pub github_user_id: String,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, utoipa::ToSchema)]
pub struct InitGithubLinkResponse {
    /// The OAuth authorization URL to redirect the user to
    pub authorization_url: String,
    /// The link ID for tracking the OAuth flow
    pub link_id: uuid::Uuid,
}

/// Error type for init Github operations
#[derive(thiserror::Error, Debug)]
pub enum InitGithubLinkError {
    /// Invalid user ID format
    #[error("invalid user ID format")]
    InvalidUserId(#[from] uuid::Error),
    /// Too many in-progress links
    #[error("too many in progress links")]
    TooManyInProgressLinks,
    /// Internal error
    #[error("internal error occurred")]
    InternalError(#[from] anyhow::Error),
    /// Internal github error
    #[error("internal error occurred")]
    GithubServiceError(#[from] GithubError),
    /// The identity provider was not found for a reason other than an
    /// unconfigured connector.
    #[error("identity provider not found")]
    IdentityProviderNotFound,
    /// FusionAuth has no `github` identity provider: the GitHub OAuth app is
    /// not configured for this deployment, so no link can start.
    #[error("github identity provider not configured")]
    NotConfigured { redirect_uri: String },
    /// The sign-in service could not be reached to look up the provider.
    #[error(transparent)]
    Upstream(UpstreamError),
}

impl IntoResponse for InitGithubLinkError {
    fn into_response(self) -> Response {
        let message = self.to_string();
        let status_code: StatusCode = match self {
            InitGithubLinkError::NotConfigured { redirect_uri } => {
                return (
                    StatusCode::CONFLICT,
                    Json(GithubLinkNotConfiguredResponse {
                        code: GITHUB_NOT_CONFIGURED_CODE.to_string(),
                        message: GITHUB_NOT_CONFIGURED_MESSAGE.to_string(),
                        redirect_uri,
                        missing_settings: vec![
                            "GITHUB_CLIENT_ID".to_string(),
                            "GITHUB_CLIENT_SECRET".to_string(),
                        ],
                    }),
                )
                    .into_response();
            }
            InitGithubLinkError::InvalidUserId(_) => StatusCode::BAD_REQUEST,
            InitGithubLinkError::TooManyInProgressLinks => StatusCode::TOO_MANY_REQUESTS,
            InitGithubLinkError::Upstream(error)
            | InitGithubLinkError::GithubServiceError(GithubError::Upstream(error)) => {
                return error.into_response();
            }
            InitGithubLinkError::InternalError(_)
            | InitGithubLinkError::GithubServiceError(_)
            | InitGithubLinkError::IdentityProviderNotFound => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (
            status_code,
            Json(ErrorResponse {
                message: message.into(),
            }),
        )
            .into_response()
    }
}

const NO_GITHUB_LINK_MESSAGE: &str = "no github link found";

/// Whether a provider lookup failed because FusionAuth knows no provider by
/// that name, as opposed to failing to answer at all.
fn is_missing_identity_provider(error: &fusionauth::error::FusionAuthClientError) -> bool {
    matches!(
        error,
        fusionauth::error::FusionAuthClientError::NoIdentityProviderFound
    )
}

fn error_response(status_code: StatusCode, message: &'static str) -> Response {
    (
        status_code,
        Json(ErrorResponse {
            message: message.into(),
        }),
    )
        .into_response()
}

#[derive(thiserror::Error, Debug)]
pub enum GithubLinkStatusError {
    #[error(transparent)]
    Github(#[from] GithubError),
}

impl IntoResponse for GithubLinkStatusError {
    fn into_response(self) -> Response {
        let Self::Github(error) = self;
        if let GithubError::Upstream(error) = error {
            return error.into_response();
        }
        tracing::error!(error=?error, "failed to check GitHub link status");
        error_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
    }
}

/// Checks whether the authenticated user's GitHub link token is valid.
#[utoipa::path(
        get,
        operation_id = "check_github_link_status",
        path = "/link/github/status",
        responses(
            (status = 200, body=GithubLinkStatusResponse),
            (status = 401, body=ErrorResponse),
            (status = 404, body=ErrorResponse),
            (status = 428, body=ErrorResponse),
            (status = 500, body=ErrorResponse),
            (status = 502, body=UpstreamErrorResponse),
            (status = 503, body=UpstreamErrorResponse),
        )
    )]
#[tracing::instrument(skip(ctx, ip_context, authorization), fields(client_ip=%ip_context, user_id=%authorization.authorization.user.macro_user_id), err)]
pub async fn check_github_link_status_handler(
    State(ctx): State<ApiContext>,
    ip_context: ClientIp,
    authorization: RoxAuthorizationExtractor<AuthorizationService, AccountHolderOrInternal>,
) -> Result<Response, GithubLinkStatusError> {
    let user_id = &authorization.authorization.user.macro_user_id;
    let status = ctx
        .github_link_service
        .get_user_link_status(user_id)
        .await?;
    // No link and an expired token are expected states: answer them here
    // rather than as `Err`, which `instrument(err)` would log as an error.
    let response = match status {
        GithubLinkStatus::Linked(link) => Json(GithubLinkStatusResponse {
            reauthentication_required: false,
            github_username: link.github_username,
            github_user_id: link.github_user_id,
        })
        .into_response(),
        GithubLinkStatus::NotLinked => {
            error_response(StatusCode::NOT_FOUND, NO_GITHUB_LINK_MESSAGE)
        }
        GithubLinkStatus::ReauthenticationRequired => error_response(
            StatusCode::PRECONDITION_REQUIRED,
            REAUTHENTICATION_REQUIRED_MESSAGE,
        ),
    };

    Ok(response)
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct InitGithubLinkQueryParams {
    /// Once the frontend is update to NOT 2x urlencode this then this should be changed to
    /// `Option<Url>`
    original_url: Option<UrlEncoded<Url>>,
}

/// Initiates a link for a user
#[utoipa::path(
        post,
        operation_id = "init_github_link",
        path = "/link/github",
        params(
            ("original_url" = String, Query, description = "**OPTIONAL**. The original url to redirect to.")
        ),
        responses(
            (status = 200, body=InitGithubLinkResponse),
            (status = 400, body=ErrorResponse),
            (status = 409, body=GithubLinkNotConfiguredResponse),
            (status = 429, body=ErrorResponse),
            (status = 401, body=ErrorResponse),
            (status = 500, body=ErrorResponse),
            (status = 502, body=UpstreamErrorResponse),
            (status = 503, body=UpstreamErrorResponse),
        )
    )]
#[tracing::instrument(skip(ctx, ip_context, authorization), fields(client_ip=%ip_context, user_id=%authorization.authorization.user.user_context.user_id, fusion_user_id=%authorization.authorization.user.user_context.fusion_user_id), err)]
pub async fn init_github_link_handler(
    State(ctx): State<ApiContext>,
    query: Query<InitGithubLinkQueryParams>,
    ip_context: ClientIp,
    authorization: RoxAuthorizationExtractor<AuthorizationService, AccountHolderOrInternal>,
) -> Result<Json<InitGithubLinkResponse>, InitGithubLinkError> {
    let Query(InitGithubLinkQueryParams { original_url }) = query;
    let fusion_user_id = &authorization.authorization.user.user_context.fusion_user_id;
    let initiator =
        rox_uuid::string_to_uuid(fusion_user_id).context("fusion user id must be a uuid")?;

    // The callback the GitHub OAuth app has to accept. Resolved before any
    // state is written so a misconfiguration can name it.
    let redirect_uri = crate::api::oauth2::format_redirect_uri(LinkProvider::Github.as_str());

    // Get Github integration identity provider ID from context. Look it up
    // before creating the pending link: a deployment without the provider
    // would otherwise leave one dangling row per click until the user hits the
    // in-progress cap and gets a misleading "too many links" answer.
    let github_idp_id = &ctx
        .auth_client
        .get_identity_provider_id_by_name("github")
        .await
        .map_err(|error| match error.upstream() {
            Some(upstream) => InitGithubLinkError::Upstream(upstream),
            None if is_missing_identity_provider(&error) => {
                tracing::warn!(
                    redirect_uri=%redirect_uri,
                    "FusionAuth has no github identity provider; refusing to start a link"
                );
                InitGithubLinkError::NotConfigured {
                    redirect_uri: redirect_uri.clone(),
                }
            }
            None => {
                tracing::error!(error=?error, "failed to look up the github identity provider");
                InitGithubLinkError::IdentityProviderNotFound
            }
        })?;

    // TODO: this should probably be a middleware or extractor
    // Check count of in-progress links
    let count =
        rox_db_client::in_progress_user_link::count_existing_in_progress_user_links_for_user(
            &ctx.db,
            fusion_user_id,
        )
        .await?;

    if count >= 5 {
        return Err(InitGithubLinkError::TooManyInProgressLinks);
    }

    // Create in-progress link
    let link_id = rox_db_client::in_progress_user_link::create_in_progress_user_link(
        &ctx.db,
        fusion_user_id,
    )
    .await?;

    // Build the signed OAuth state. The callback refuses state it did not sign,
    // state issued for another provider, and state whose pending link belongs
    // to a different user.
    let state = AccountLinkState::new(
        LinkProvider::Github,
        github_idp_id.clone(),
        link_id,
        initiator,
        original_url.map(|x| x.0.to_string()),
    );
    let state = sign_account_link_state(&state, &ctx.account_link_state_key)
        .context("failed to sign OAuth state")?;

    let authorization_url = ctx
        .github_link_service
        .construct_oauth_url(&redirect_uri, &state)
        .map_err(InitGithubLinkError::GithubServiceError)?;

    Ok(Json(InitGithubLinkResponse {
        authorization_url,
        link_id,
    }))
}

/// Error type for delete Github link operations
#[derive(thiserror::Error, Debug)]
pub enum DeleteGithubLinkError {
    /// Internal error
    #[error("internal error occurred")]
    InternalError(#[from] anyhow::Error),
    /// Internal github error
    #[error("internal error occurred")]
    GithubServiceError(#[from] GithubError),
}

impl IntoResponse for DeleteGithubLinkError {
    fn into_response(self) -> Response {
        let message = self.to_string();
        let status_code: StatusCode = match self {
            DeleteGithubLinkError::GithubServiceError(GithubError::Upstream(error)) => {
                return error.into_response();
            }
            DeleteGithubLinkError::InternalError(_)
            | DeleteGithubLinkError::GithubServiceError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (
            status_code,
            Json(ErrorResponse {
                message: message.into(),
            }),
        )
            .into_response()
    }
}

/// Deletes a github link for a user
#[utoipa::path(
        delete,
        operation_id = "delete_github_link",
        path = "/link/github",
        responses(
            (status = 200, body=EmptyResponse),
            (status = 400, body=ErrorResponse),
            (status = 401, body=ErrorResponse),
            (status = 500, body=ErrorResponse),
            (status = 502, body=UpstreamErrorResponse),
            (status = 503, body=UpstreamErrorResponse),
        )
    )]
#[tracing::instrument(skip(ctx, ip_context, authorization), fields(client_ip=%ip_context, user_id=%authorization.authorization.user.macro_user_id), err)]
pub async fn delete_github_link_handler(
    State(ctx): State<ApiContext>,
    ip_context: ClientIp,
    authorization: RoxAuthorizationExtractor<AuthorizationService, AccountHolderOrInternal>,
) -> Result<Json<EmptyResponse>, DeleteGithubLinkError> {
    ctx.github_link_service
        .delete_user_link(&authorization.authorization.user.macro_user_id)
        .await?;

    Ok(Json(EmptyResponse::default()))
}
