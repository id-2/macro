use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use rox_authorization::{RoxAuthorizationExtractor, UserOrInternal};
use model::response::{EmptyResponse, ErrorResponse};

use crate::api::context::{ApiContext, AuthorizationService};

use super::unsubscribe_item::UnsubscribeItemPathParams;

/// Removes a unsubscribe item for a user.
#[utoipa::path(
        delete,
        operation_id = "remove_unsubscribe_item",
        path = "/unsubscribe/item/{item_type}/{item_id}",
        params(UnsubscribeItemPathParams),
        responses(
            (status = 200, body=EmptyResponse),
            (status = 401, body=ErrorResponse),
            (status = 500, body=ErrorResponse),
        )
    )]
#[tracing::instrument(skip(ctx, user))]
pub async fn handler(
    State(ctx): State<ApiContext>,
    user: RoxAuthorizationExtractor<AuthorizationService, UserOrInternal>,
    Path(UnsubscribeItemPathParams { item_type, item_id }): Path<UnsubscribeItemPathParams>,
) -> Result<Response, Response> {
    ctx.item_preferences
        .remove(
            user.authorization.user.rox_user_id,
            item_type.with_entity_string(item_id),
        )
        .await
        .map_err(|e| {
            tracing::error!(error=?e, "unable to remove unsubscribe item");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "unable to remove unsubscribe item".into(),
                }),
            )
                .into_response()
        })?;

    Ok((StatusCode::OK, Json(EmptyResponse {})).into_response())
}
