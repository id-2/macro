use super::*;

#[test]
fn target_authority_never_overrides_visibility_or_namespace() {
    let team = Uuid::now_v7().try_into().unwrap();
    let other_team = Uuid::now_v7().try_into().unwrap();
    let pair = HashSet::from([
        RoxUserIdStr::parse_from_str("rox|one@example.com").unwrap(),
        RoxUserIdStr::parse_from_str("rox|two@example.com").unwrap(),
    ]);
    for source in [
        ConversationKind::PublicChannel,
        ConversationKind::PrivateChannel,
        ConversationKind::GroupDirectMessage,
        ConversationKind::DirectMessage,
    ] {
        for kind in [
            TargetKind::Public,
            TargetKind::Team(team),
            TargetKind::Team(other_team),
            TargetKind::Private,
            TargetKind::DirectMessage,
        ] {
            for prior in [false, true] {
                for access in [
                    TargetAccess::None,
                    TargetAccess::Participant,
                    TargetAccess::ManageParticipants,
                ] {
                    let expected = match (source, kind) {
                        (ConversationKind::PublicChannel, TargetKind::Team(actual)) => {
                            actual == team
                        }
                        (
                            ConversationKind::PrivateChannel | ConversationKind::GroupDirectMessage,
                            TargetKind::Private,
                        ) => prior || access == TargetAccess::ManageParticipants,
                        (ConversationKind::DirectMessage, TargetKind::DirectMessage) => {
                            prior || access != TargetAccess::None
                        }
                        _ => false,
                    };
                    let facts = TargetFacts {
                        id: Uuid::now_v7(),
                        kind,
                        dm_members: pair.clone(),
                    };
                    assert_eq!(
                        authorize_target(team, source, &facts, prior, access).is_ok(),
                        expected
                    );
                }
            }
        }
    }
    let malformed = TargetFacts {
        id: Uuid::now_v7(),
        kind: TargetKind::DirectMessage,
        dm_members: HashSet::new(),
    };
    assert!(
        authorize_target(
            team,
            ConversationKind::DirectMessage,
            &malformed,
            true,
            TargetAccess::ManageParticipants
        )
        .is_err()
    );
}
