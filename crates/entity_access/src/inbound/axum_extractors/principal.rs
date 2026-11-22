//! Shared capability minting for authenticated entity-message adapters.

#[cfg(test)]
mod test;

use crate::domain::{
    models::{AccessError, BotAccessScope, EntityAccessReceipt, EntityType, RequiredPermission},
    ports::EntityAccessService,
};
use rox_authorization::RoxAuthorization;

/// Mint a parent capability while preserving bot identity and its verified scope.
/// Identity-less internal services and harness credentials cannot impersonate a message author.
pub async fn principal_entity_access_receipt<T: RequiredPermission>(
    service: &impl EntityAccessService,
    principal: &RoxAuthorization,
    entity_id: &str,
    entity_type: EntityType,
) -> Result<EntityAccessReceipt<T>, AccessError> {
    match principal {
        RoxAuthorization::Bot(authentication) => {
            let scope = super::bot::map_bot_access_scope(authentication)
                .map_err(|_| AccessError::Unauthorized)?;
            service
                .generate_bot_entity_access_receipt::<T>(
                    authentication.bot_id,
                    scope,
                    entity_id,
                    entity_type,
                )
                .await
        }
        RoxAuthorization::User(user) | RoxAuthorization::Internal(Some(user)) => {
            service
                .generate_entity_access_receipt::<T>(
                    &user.rox_user_id,
                    user.user_context.organization_id.map(i64::from),
                    entity_id,
                    entity_type,
                )
                .await
        }
        RoxAuthorization::Internal(None) | RoxAuthorization::Harness(_) => {
            Err(AccessError::Unauthorized)
        }
    }
}

/// Mint a new message's sender capability, retaining signed agent attribution.
/// Use the caller capability above for reads, edits, deletes, and reactions.
pub async fn message_sender_entity_access_receipt<T: RequiredPermission>(
    service: &impl EntityAccessService,
    principal: &RoxAuthorization,
    entity_id: &str,
    entity_type: EntityType,
) -> Result<EntityAccessReceipt<T>, AccessError> {
    if let RoxAuthorization::User(user) = principal
        && let Some(agent_id) = user.agent_id
    {
        return service
            .generate_bot_entity_access_receipt::<T>(
                agent_id,
                BotAccessScope::User {
                    user_id: user.rox_user_id.clone(),
                    user_org_id: user.user_context.organization_id.map(i64::from),
                },
                entity_id,
                entity_type,
            )
            .await;
    }
    principal_entity_access_receipt(service, principal, entity_id, entity_type).await
}
