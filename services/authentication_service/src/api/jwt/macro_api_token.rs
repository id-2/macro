use crate::api::context::{AuthorizationService, RoxApiTokenContext};
use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use rox_auth::macro_api_token::EncodeRoxApiTokenArgs;
use rox_authorization::{AccountHolderOrInternal, RoxAuthorizationExtractor, is_program_run};
use sqlx::PgPool;
use utoipa::ToSchema;

#[cfg(test)]
mod test;

/// Why a program may not mint a Macro API token.
const PROGRAM_TOKEN_REFUSAL: &str = "An agent's program cannot mint a Rox API token: it would reach you and outlive the run. Use the credential the run already has; for a lasting key, tell the user to create one in Rox's settings.";

#[derive(serde::Serialize, serde::Deserialize, Debug, ToSchema)]
pub struct RoxApiTokenResponse {
    /// The newly created macro_api_token
    pub macro_api_token: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct RoxApiTokenQuery {
    /// The email to generate the macro-api-token for
    pub email: Option<String>,
}

/// Generates a macro-api-token using the user's macro-access-token
/// You can either have your access token in the cookies or in the request
/// headers
/// Authorization: Bearer <access_token>
/// This returns a new macro-api-token
#[utoipa::path(
        get,
        operation_id = "macro_api_token",
        path = "/jwt/macro_api_token",
        params(
            ("email" = String, Query, description = "The email to generate the macro-api-token for. If not provided, we use your default profile."),
        ),
        responses(
            (status = 200, body = RoxApiTokenResponse),
            (status = 401, body=String),
            (status = 500, body=String),
        )
    )]
#[tracing::instrument(skip_all)]
pub async fn handler(
    State(db): State<PgPool>,
    State(macro_api_token_context): State<RoxApiTokenContext>,
    authorization: RoxAuthorizationExtractor<AuthorizationService, AccountHolderOrInternal>,
    headers: HeaderMap,
    Query(query): Query<RoxApiTokenQuery>,
) -> Result<Response, Response> {
    // A program's run credential lives about a minute; a token minted here
    // lives an hour and would reach the model, so programs keep the one they
    // were given.
    let attribution = authorization.authorization.user.attribution();
    if is_program_run(attribution, &headers) {
        tracing::warn!(?attribution, "refused a Macro API token to a program");
        return Err((StatusCode::FORBIDDEN, PROGRAM_TOKEN_REFUSAL).into_response());
    }
    let user_context = &authorization.authorization.user.user_context;
    let email: std::borrow::Cow<'_, str> = if let Some(email) = query.email.as_deref() {
        // TODO: figure out if email is url_encoded by default
        urlencoding::decode(email).map_err(|e| {
            tracing::error!(error=?e, "unable to decode email");
            (StatusCode::BAD_REQUEST, "unable to decode email").into_response()
        })?
    } else if user_context.user_id.is_empty() {
        tracing::error!("user_id is empty");
        return Err((StatusCode::UNAUTHORIZED, "unauthorized").into_response());
    } else {
        std::borrow::Cow::Borrowed(rox_user_id::user_id::strip_user_id_prefix(
            &user_context.user_id,
        ))
    };

    let user_profile =
        rox_db_client::user::get::get_user_profile_by_fusionauth_user_id_and_email(
            &db,
            &user_context.fusion_user_id,
            email.as_ref(),
        )
        .await
        .map_err(|e| {
            tracing::error!(error=?e, "unable to get user profile by fusionauth user id and email");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "unable to get user profile by fusionauth user id and email",
            )
                .into_response()
        })?;

    let (macro_user_id, organization_id) =
        if let Some((macro_user_id, organization_id)) = user_profile {
            (macro_user_id, organization_id)
        } else {
            tracing::error!("macro user id is none");
            return Err((StatusCode::UNAUTHORIZED, "no access to this profile").into_response());
        };

    let macro_api_token =
        rox_auth::macro_api_token::encode_macro_api_token(EncodeRoxApiTokenArgs {
            agent_correlation_id: None,
            agent_session_id: None,
            // Programs are refused above, so these claims are empty here; they
            // are still copied so a relaxed refusal could never shed them.
            routine_id: agent_correlation::context::current_routine(),
            // No scope to keep: `AccountHolderOrInternal` refuses this route
            // to every credential that signs one (`ScopedRoxApiJwt`).
            agent_scope: None,
            agent_id: authorization
                .authorization
                .user
                .agent_id
                .map(|agent| agent.as_uuid()),
            agent_via: authorization.authorization.user.agent_via.clone(),
            macro_user_id,
            fusionauth_id: user_context.fusion_user_id.clone(),
            organization_id, // TOOD: get from user profile
            issuer: macro_api_token_context.issuer.to_string(),
            private_key: macro_api_token_context
                .macro_api_token_private_key
                .as_ref()
                .to_string(),
            expiry_seconds: macro_api_token_context.expiry_seconds,
        })
        .map_err(|e| {
            tracing::error!(error=?e, "unable to encode macro-api-token");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "unable to encode macro-api-token",
            )
                .into_response()
        })?;

    Ok((
        StatusCode::OK,
        Json(RoxApiTokenResponse { macro_api_token }),
    )
        .into_response())
}
