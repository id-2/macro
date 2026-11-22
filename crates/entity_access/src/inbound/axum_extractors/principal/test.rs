use super::*;
use crate::{
    domain::models::{
        AccessLevel, EditAccessLevel, EntityPermission, MemberParticipantRole, ParticipantRole,
    },
    inbound::axum_extractors::test_support::{BotAccessCall, FakeEntityAccessService},
};
use rox_authorization::RoxUserAuthentication;
use model_user::UserContext;

#[tokio::test]
async fn signed_agent_uses_owner_scope_and_preserves_both_identities() {
    let service =
        FakeEntityAccessService::new(None).with_bot_permission(EntityPermission::ChannelRole {
            role: ParticipantRole::Member,
        });
    let agent_id = bot_id::ROX_NEW_BOT_ID;
    let owner = "rox|owner@example.com".to_string().try_into().unwrap();
    let principal = RoxAuthorization::User(RoxUserAuthentication {
        origin: rox_authorization::CredentialOrigin::RoxApiJwt,
        agent_id: Some(agent_id),
        agent_via: None,
        rox_user_id: owner,
        user_context: UserContext {
            user_id: "rox|owner@example.com".into(),
            fusion_user_id: "fusion-owner".into(),
            organization_id: Some(42),
            permissions: None,
        },
    });
    let receipt = message_sender_entity_access_receipt::<MemberParticipantRole>(
        &service,
        &principal,
        "channel-id",
        EntityType::Channel,
    )
    .await
    .unwrap();

    assert_eq!(receipt.get_authenticated_bot().unwrap().bot_id(), agent_id);
    assert_eq!(
        receipt.acting_user_id().unwrap().as_ref(),
        "rox|owner@example.com"
    );
    assert_eq!(
        service.bot_calls(),
        vec![BotAccessCall {
            bot_id: agent_id,
            scope: BotAccessScope::User {
                user_id: "rox|owner@example.com".to_string().try_into().unwrap(),
                user_org_id: Some(42),
            },
            entity_id: "channel-id".into(),
            entity_type: EntityType::Channel,
        }]
    );
}

#[tokio::test]
async fn signed_agent_cannot_send_without_owner_access() {
    let service = FakeEntityAccessService::new(None);
    let principal = RoxAuthorization::User(RoxUserAuthentication {
        origin: rox_authorization::CredentialOrigin::RoxApiJwt,
        agent_id: Some(bot_id::ROX_NEW_BOT_ID),
        agent_via: None,
        rox_user_id: "rox|owner@example.com".to_string().try_into().unwrap(),
        user_context: UserContext {
            user_id: "rox|owner@example.com".into(),
            fusion_user_id: "fusion-owner".into(),
            organization_id: None,
            permissions: None,
        },
    });
    assert!(matches!(
        message_sender_entity_access_receipt::<MemberParticipantRole>(
            &service,
            &principal,
            "channel-id",
            EntityType::Channel,
        )
        .await,
        Err(AccessError::Unauthorized)
    ));
}

#[tokio::test]
async fn signed_agent_does_not_change_caller_identity_for_existing_messages() {
    let service = FakeEntityAccessService::new(Some(AccessLevel::Edit));
    let principal = RoxAuthorization::User(RoxUserAuthentication {
        origin: rox_authorization::CredentialOrigin::RoxApiJwt,
        agent_id: Some(bot_id::ROX_NEW_BOT_ID),
        agent_via: None,
        rox_user_id: "rox|owner@example.com".to_string().try_into().unwrap(),
        user_context: UserContext {
            user_id: "rox|owner@example.com".into(),
            fusion_user_id: "fusion-owner".into(),
            organization_id: Some(42),
            permissions: None,
        },
    });
    let receipt = principal_entity_access_receipt::<EditAccessLevel>(
        &service,
        &principal,
        "document-id",
        EntityType::Document,
    )
    .await
    .unwrap();
    assert_eq!(
        receipt.get_authenticated_user().unwrap().as_ref(),
        "rox|owner@example.com"
    );
    assert!(receipt.get_authenticated_bot().is_err());
    assert!(service.bot_calls().is_empty());
}
