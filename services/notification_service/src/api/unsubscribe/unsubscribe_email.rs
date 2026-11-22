use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use rox_authorization::{RoxAuthorizationExtractor, UserOrInternal};
use model::response::{EmptyResponse, ErrorResponse};

use crate::api::context::{ApiContext, AuthorizationService};

/// Unsubscribes a user from receiving emails
#[utoipa::path(
        post,
        operation_id = "unsubscribe_email",
        path = "/unsubscribe/email",
        responses(
            (status = 200, body=EmptyResponse),
            (status = 404, body=ErrorResponse),
            (status = 500, body=ErrorResponse),
        )
    )]
#[tracing::instrument(skip(ctx, user))]
pub async fn handler(
    State(ctx): State<ApiContext>,
    user: RoxAuthorizationExtractor<AuthorizationService, UserOrInternal>,
) -> Result<Response, Response> {
    let user_context = &user.authorization.user.user_context;
    let email = rox_user_id::user_id::strip_user_id_prefix(&user_context.user_id);
    notification_db_client::unsubscribe::email::upsert_email_unsubscribe(&ctx.db, email)
        .await
        .map_err(|e| {
            tracing::error!(error=?e, email=?email, "unable to unsubscribe email");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "unable to unsubscribe email".into(),
                }),
            )
                .into_response()
        })?;

    Ok((StatusCode::OK, Json(EmptyResponse {})).into_response())
}
