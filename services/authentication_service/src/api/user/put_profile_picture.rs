use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};

use super::profile_picture_change::{
    picture_changed_metadata, publish_picture_changed, throttle_set,
};
use crate::api::context::{ApiContext, AuthorizationService};

use rox_authorization::{RoxAuthorizationExtractor, UserOrInternal};
use rox_db_client::user::update_profile_picture::update_profile_picture;
use model::response::{EmptyResponse, ErrorResponse};
use serde::Deserialize;

#[derive(Deserialize, Debug, utoipa::IntoParams)]
pub struct ProfilePictureQueryParams {
    /// profile picture URL
    url: String,
}

/// Sets the profile picture URL for a particular user
#[utoipa::path(
        put,
        path = "/user/profile_picture",
        operation_id = "put_profile_picture",
        responses(
            (status = 200, body=EmptyResponse),
            (status = 401, body=String),
            (status = 429, body=ErrorResponse, description = "Picture changed less than a second ago"),
            (status = 500, body=ErrorResponse),
        ),
        params(ProfilePictureQueryParams),
    )]
#[tracing::instrument(skip(ctx, authorization), fields(rate_limited = tracing::field::Empty))]
pub async fn handler(
    State(ctx): State<ApiContext>,
    Query(params): Query<ProfilePictureQueryParams>,
    authorization: RoxAuthorizationExtractor<AuthorizationService, UserOrInternal>,
) -> Result<Response, Response> {
    let rox_user_id = authorization.authorization.user.rox_user_id.clone();
    throttle_set(&ctx, rox_user_id.as_ref())
        .await
        .map_err(IntoResponse::into_response)?;

    update_profile_picture(
        &ctx.db,
        &authorization.authorization.user.user_context.fusion_user_id,
        &params.url,
        "000",
    )
    .await
    .map_err(|e| {
        tracing::error!(error=?e, user_id = %authorization.authorization.user.user_context.user_id, "failed to update user profile picture");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
    })?;
    publish_picture_changed(
        &ctx,
        picture_changed_metadata(rox_user_id, None, &params.url),
    );
    Ok((StatusCode::OK, Json(EmptyResponse {})).into_response())
}
