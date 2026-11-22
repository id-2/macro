use super::*;
use rox_db_migrator::ROX_DB_MIGRATIONS;
use rox_uuid::Uuid;

/// One stored bot with a profile; every other bot has none.
struct ProfiledBot;
impl BotNames for ProfiledBot {
    async fn bot_names(&self, bot_ids: &[BotId]) -> Result<HashMap<BotId, String>> {
        Ok(bot_ids
            .iter()
            .filter(|bot_id| **bot_id == BotId::new_from_uuid(Uuid::from_u128(1)))
            .map(|bot_id| (*bot_id, "Release Bot".to_owned()))
            .collect())
    }
}

#[sqlx::test(
    migrator = "ROX_DB_MIGRATIONS",
    fixtures(path = "fixtures", scripts("people"))
)]
async fn names_each_id_in_order(pool: PgPool) {
    let directory = PgPeopleDirectory::new(pool, ProfiledBot);

    let people = directory
        .people(vec![
            "rox|julia@example.com".to_owned(),
            "bot|00000000-0000-0000-0000-000000000001".to_owned(),
            "rox|teo@example.com".to_owned(),
            "rox|nameless@example.com".to_owned(),
            "bot|00000000-0000-0000-0000-000000000002".to_owned(),
            "rox|julia@example.com".to_owned(),
        ])
        .await
        .unwrap();

    assert_eq!(
        people,
        [
            ContextPerson {
                id: "rox|julia@example.com".to_owned(),
                name: "Julia Rivera".to_owned(),
                email: Some("julia@example.com".to_owned()),
            },
            ContextPerson {
                id: "bot|00000000-0000-0000-0000-000000000001".to_owned(),
                name: "Release Bot".to_owned(),
                email: None,
            },
            ContextPerson {
                id: "rox|teo@example.com".to_owned(),
                name: "Teo".to_owned(),
                email: Some("teo@example.com".to_owned()),
            },
            ContextPerson {
                id: "rox|nameless@example.com".to_owned(),
                name: "nameless@example.com".to_owned(),
                email: Some("nameless@example.com".to_owned()),
            },
            ContextPerson {
                id: "bot|00000000-0000-0000-0000-000000000002".to_owned(),
                name: "bot|00000000-0000-0000-0000-000000000002".to_owned(),
                email: None,
            },
            ContextPerson {
                id: "rox|julia@example.com".to_owned(),
                name: "Julia Rivera".to_owned(),
                email: Some("julia@example.com".to_owned()),
            },
        ]
    );
}
