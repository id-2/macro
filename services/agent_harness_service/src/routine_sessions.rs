//! Compose routine operations from the same session, harness, and persona capabilities.

use std::sync::Arc;

use agent_session::domain::ports::{
    AgentSessionNotificationRecipient, AgentSessionRepo, BotDirectory, SessionOpener,
};
use agent_session::domain::routines::{ConnectedApps, RoutineSessionsService};
use agent_session::domain::service::AgentSessionService;
use agent_session::inbound::routine_sessions::{RoutineSessionsState, routine_sessions_router};
use axum::Router;
use rox_authorization::{RoxAuthorizationService, RoxAuthorizationState};
use rox_event_broker::RoxEventBroker;
use rox_user_id::user_id::RoxUserIdStr;
use pipedream_mcp::domain::ports::ConnectionStore;

use crate::external_session_requests::BrokerExternalSessionRequests;

/// Reuse live harness/session instances and the existing external-request adapter.
pub fn router<Bots, Harness, Sessions, Broker, Repo, Connections, Auth>(
    bots: Bots,
    harness: Harness,
    sessions: Sessions,
    external_requests: BrokerExternalSessionRequests<Broker, Repo>,
    connections: Connections,
    authorization: RoxAuthorizationState<Auth>,
) -> Router
where
    Bots: BotDirectory,
    Harness: SessionOpener + AgentSessionNotificationRecipient + Clone,
    Sessions: AgentSessionService,
    Broker: RoxEventBroker,
    Repo: AgentSessionRepo,
    Connections: ConnectionStore,
    Auth: RoxAuthorizationService,
{
    let service = RoutineSessionsService::new(
        bots,
        harness.clone(),
        external_requests,
        sessions,
        harness,
        PipedreamConnectedApps(connections),
    );
    routine_sessions_router(RoutineSessionsState::new(Arc::new(service), authorization))
}

/// A user's Pipedream connections, counted as connected the way the egress
/// proxy counts them: enabled rows only.
pub struct PipedreamConnectedApps<Connections>(pub Connections);

impl<Connections: ConnectionStore> ConnectedApps for PipedreamConnectedApps<Connections> {
    async fn connected_app_slugs(
        &self,
        user: &RoxUserIdStr<'static>,
    ) -> anyhow::Result<Vec<String>> {
        Ok(self
            .0
            .list(user)
            .await
            .map_err(|error| anyhow::anyhow!("could not list Pipedream connections: {error:?}"))?
            .into_iter()
            .filter(|connection| connection.enabled)
            .map(|connection| connection.app_slug)
            .collect())
    }
}
