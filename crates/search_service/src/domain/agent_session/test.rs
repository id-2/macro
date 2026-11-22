use super::*;
use rox_user_id::user_id::RoxUserIdStr;

struct Source;
impl AgentSessionSearchSource for Source {
    async fn accessible(
        &self,
        user: &RoxUserId<Lowercase<'_>>,
        _: &[Uuid],
    ) -> Result<Vec<AgentSessionSearchMetadata>, Report> {
        if user.as_ref() == "rox|stranger@example.com" {
            return Ok(Vec::new());
        }
        Ok(vec![AgentSessionSearchMetadata {
            id: Uuid::from_u128(1),
            name: "Shared session".into(),
            owner_id: RoxUserIdStr::parse_from_str("rox|owner@example.com").unwrap(),
            bot_id: Uuid::from_u128(2),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }])
    }
}

#[tokio::test]
async fn grants_allow_channel_viewers_without_requiring_ownership() {
    let service = AgentSessionSearchService(Source);
    let viewer = RoxUserId::parse_from_str("rox|viewer@example.com")
        .unwrap()
        .lowercase();
    assert_eq!(
        service
            .scope(&viewer, &[], &[], true, false)
            .await
            .unwrap()
            .len(),
        1
    );
    let stranger = RoxUserId::parse_from_str("rox|stranger@example.com")
        .unwrap()
        .lowercase();
    assert!(
        service
            .scope(&stranger, &[], &[], true, false)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn exclusion_requested_ids_owners_and_tags_cannot_broaden_access() {
    let service = AgentSessionSearchService(Source);
    let viewer = RoxUserId::parse_from_str("rox|viewer@example.com")
        .unwrap()
        .lowercase();
    for (ids, owners, enabled, tags) in [
        (vec![], vec![], false, false),
        (vec![], vec![], true, true),
        (vec![Uuid::nil()], vec![], true, false),
        (vec![Uuid::from_u128(9)], vec![], true, false),
        (vec![], vec!["rox|other@example.com".into()], true, false),
    ] {
        assert!(
            service
                .scope(&viewer, &ids, &owners, enabled, tags)
                .await
                .unwrap()
                .is_empty()
        );
    }
}
