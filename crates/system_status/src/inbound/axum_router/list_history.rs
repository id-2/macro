//! Handler for `GET /system-status/history`.

use axum::{Json, extract::State};
use rox_authorization::{RoxAuthorizationExtractor, RoxAuthorizationService, UserOrInternal};

use super::{SystemStatusHistory, SystemStatusRouterState};
use crate::domain::models::SystemStatusError;
use crate::domain::ports::SystemStatusService;

/// Recent status updates, newest first, with who set each. Macro staff only.
#[utoipa::path(
    tag = "system_status",
    get,
    path = "/system-status/history",
    operation_id = "list_system_status_history",
    responses(
        (status = 200, body = SystemStatusHistory),
        (status = 401, body = model_error_response::ErrorResponse),
        (status = 403, body = model_error_response::ErrorResponse),
        (status = 500, body = model_error_response::ErrorResponse),
    )
)]
#[tracing::instrument(skip_all, err)]
pub async fn handler<T: SystemStatusService, Auth: RoxAuthorizationService>(
    State(state): State<SystemStatusRouterState<T, Auth>>,
    authorization: RoxAuthorizationExtractor<Auth, UserOrInternal>,
) -> Result<Json<SystemStatusHistory>, SystemStatusError> {
    let caller = &authorization.authorization.user.macro_user_id;
    let updates = state.service.history(caller).await?;
    Ok(Json(SystemStatusHistory { updates }))
}
