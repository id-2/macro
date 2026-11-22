//! Handler for sync-content notifications from the synchronization service.

use activity::Actor;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use entity_access::domain::ports::EntityAccessService;
use rox_authorization::{InternalOnly, RoxAuthorizationExtractor, RoxAuthorizationService};
use rox_user_id::user_id::RoxUserIdStr;
use serde::Deserialize;

use super::{DocumentRouterState, Params};
use crate::domain::{
    events::DocumentSyncEditor, models::DocumentError, ports::DocumentContentEventService,
};

/// Attribution from the sync service's verified document token.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SyncContentUpdatedRequest {
    /// Legacy single agent actor from older Sync releases.
    pub actor: Option<String>,
    /// User represented by the legacy actor, if any.
    pub on_behalf_of: Option<String>,
    /// Editors accumulated by Sync since its last snapshot notification.
    #[serde(default)]
    pub editors: Vec<DocumentSyncEditor>,
}

/// Publish an event using the document's stored metadata.
#[tracing::instrument(err, skip(state, _internal_authorization))]
pub async fn sync_content_updated_handler<
    T: DocumentContentEventService,
    Svc: EntityAccessService,
    Auth: RoxAuthorizationService,
>(
    State(state): State<DocumentRouterState<T, Svc, Auth>>,
    _internal_authorization: RoxAuthorizationExtractor<Auth, InternalOnly>,
    Path(Params { document_id }): Path<Params>,
    Json(request): Json<SyncContentUpdatedRequest>,
) -> Result<StatusCode, DocumentError> {
    let mut editors = request.editors;
    // Sync releases before batched editors sent a single agent actor. Invalid
    // legacy ids are dropped, as they always were, so search still extracts.
    if let Some(actor) = request.actor.and_then(|actor| Actor::try_from(actor).ok()) {
        editors.push(DocumentSyncEditor {
            agent_correlation_id: None,
            actor,
            on_behalf_of: request
                .on_behalf_of
                .and_then(|user| RoxUserIdStr::try_from(user).ok()),
        });
    }
    state
        .service
        .publish_sync_content_updated(&document_id, editors)
        .await?;
    Ok(StatusCode::OK)
}
