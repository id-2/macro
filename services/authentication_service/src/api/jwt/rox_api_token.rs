use crate::api::context::{AuthorizationService, RoxApiTokenContext};
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use rox_auth::rox_api_token::EncodeMacroApiTokenArgs;
use rox_authorization::{AccountHolderOrInternal, RoxAuthorizationExtractor};
use sqlx::PgPool;
use utoipa::ToSchema;

#[derive(serde::Serialize, serde::Deserialize, Debug, ToSchema)]
pub struct RoxApiTokenResponse {
    /// The newly created rox_api_token
    pub rox_api_token: String,
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
        operation_id = "rox_api_token",
        path = "/jwt/rox_api_token",
        params(
            ("email" = String, Query, description = "The email to generate the macro-api-token for. If not provided, we use your default profile."),
        ),
        responses(
            (status = 200, body = RoxApiTokenResponse),
            (status = 401, body=String),
            (status = 500, body=String),
        )
    )]
#[tracing::instrument(skip(db, rox_api_token_context, authorization))]
pub async fn handler(
    State(db): State<PgPool>,
    State(rox_api_token_context): State<RoxApiTokenContext>,
    authorization: RoxAuthorizationExtractor<AuthorizationService, AccountHolderOrInternal>,
    Query(query): Query<RoxApiTokenQuery>,
) -> Result<Response, Response> {
    let user_context = &authorization.authorization.user.user_context;
    let email = if let Some(email) = query.email.clone() {
        // TODO: figure out if email is url_encoded by default
        let email = urlencoding::decode(email.as_ref()).map_err(|e| {
            tracing::error!(error=?e, "unable to decode email");
            (StatusCode::BAD_REQUEST, "unable to decode email").into_response()
        })?;

        email.to_string()
    } else if user_context.user_id.is_empty() {
        tracing::error!("user_id is empty");
        return Err((StatusCode::UNAUTHORIZED, "unauthorized").into_response());
    } else {
        user_context.user_id.replace("macro|", "")
    };

    let user_profile =
        rox_db_client::user::get::get_user_profile_by_fusionauth_user_id_and_email(
            &db,
            &user_context.fusion_user_id,
            &email,
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

    let (rox_user_id, organization_id) =
        if let Some((rox_user_id, organization_id)) = user_profile {
            (rox_user_id, organization_id)
        } else {
            tracing::error!("macro user id is none");
            return Err((StatusCode::UNAUTHORIZED, "no access to this profile").into_response());
        };

    let rox_api_token =
        rox_auth::rox_api_token::encode_rox_api_token(EncodeMacroApiTokenArgs {
            agent_correlation_id: None,
            agent_session_id: None,
            // Re-minting keeps the signed routine `propagate` accepted, so a
            // routine run cannot shed it; callers can never supply one.
            routine_id: agent_correlation::context::current_routine(),
            // No scope to keep: `AccountHolderOrInternal` refuses this route
            // to every credential that signs one (`ScopedMacroApiJwt`).
            agent_scope: None,
            agent_id: authorization
                .authorization
                .user
                .agent_id
                .map(|agent| agent.as_uuid()),
            agent_via: authorization.authorization.user.agent_via.clone(),
            rox_user_id,
            fusionauth_id: user_context.fusion_user_id.clone(),
            organization_id, // TOOD: get from user profile
            issuer: rox_api_token_context.issuer.to_string(),
            private_key: rox_api_token_context
                .rox_api_token_private_key
                .as_ref()
                .to_string(),
            expiry_seconds: rox_api_token_context.expiry_seconds,
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
        Json(RoxApiTokenResponse { rox_api_token }),
    )
        .into_response())
}
