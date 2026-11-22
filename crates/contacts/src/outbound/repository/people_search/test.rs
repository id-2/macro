use super::*;
use crate::domain::{
    models::people::PeopleSearchQuery, ports::PeopleSearchService, service::ContactsDomainService,
};
use crate::outbound::gateway::ConnectionGatewayNotifier;
use rox_db_migrator::ROX_DB_MIGRATIONS;
use sqlx::PgPool;

const VIEWER: &str = "viewer@example.com";

fn service(
    pool: PgPool,
) -> ContactsDomainService<DbContactsRepository, Option<ConnectionGatewayNotifier>> {
    ContactsDomainService {
        repository: DbContactsRepository::new(pool),
        notifier: None,
    }
}

async fn search(pool: &PgPool, query: &str, limit: u32) -> Vec<(String, Option<String>, bool)> {
    service(pool.clone())
        .search_people(
            RoxUserIdStr::try_from_email(VIEWER).unwrap(),
            &PeopleSearchQuery::new(query).unwrap(),
            PeopleSearchLimit::new(limit).unwrap(),
        )
        .await
        .unwrap()
        .into_iter()
        .map(|person| {
            (
                person.contact.user_id.to_string(),
                person.contact.name,
                person.is_teammate,
            )
        })
        .collect()
}

#[sqlx::test(
    migrator = "ROX_DB_MIGRATIONS",
    fixtures(path = "fixtures", scripts("people_search"))
)]
async fn teammates_rank_first_then_prefix_then_substring_matches(pool: PgPool) {
    let people = search(&pool, "  SAM ", 20).await;
    assert_eq!(
        people,
        vec![
            // Equal prefix match to "Sam Rivera", but on the viewer's team.
            (
                "rox|teammate@example.com".to_string(),
                Some("Sam Rivers".to_string()),
                true
            ),
            (
                "rox|contact@example.com".to_string(),
                Some("Sam Rivera".to_string()),
                false
            ),
            // Not a Rox user: matched by email, named by the viewer's own address book.
            (
                "rox|samantha.book@example.org".to_string(),
                Some("Book Sam".to_string()),
                false
            ),
            // Substring of the email only, so after every prefix match; N/A is not a name.
            (
                "rox|ossam@example.com".to_string(),
                Some("Zed".to_string()),
                false
            ),
        ]
    );
}

#[sqlx::test(
    migrator = "ROX_DB_MIGRATIONS",
    fixtures(path = "fixtures", scripts("people_search"))
)]
async fn results_flag_agents_and_treat_non_rox_contacts_as_people(pool: PgPool) {
    let flags: Vec<_> = service(pool)
        .search_people(
            RoxUserIdStr::try_from_email(VIEWER).unwrap(),
            &PeopleSearchQuery::new("sam").unwrap(),
            PeopleSearchLimit::DEFAULT,
        )
        .await
        .unwrap()
        .into_iter()
        .map(|person| (person.contact.user_id.to_string(), person.is_agent))
        .collect();
    assert_eq!(
        flags,
        vec![
            ("rox|teammate@example.com".to_string(), false),
            ("rox|contact@example.com".to_string(), false),
            ("rox|samantha.book@example.org".to_string(), false),
            ("rox|ossam@example.com".to_string(), true),
        ]
    );
}

#[sqlx::test(
    migrator = "ROX_DB_MIGRATIONS",
    fixtures(path = "fixtures", scripts("people_search"))
)]
async fn search_is_scoped_to_the_viewers_contacts_self_and_team(pool: PgPool) {
    // Another user's contacts and teammates never appear, whether matched by
    // name ("Sam Other", "Sam Stranger") or by email ("samuel.private").
    let people = search(&pool, "sam", 50).await;
    for absent in [
        "rox|other@example.com",
        "rox|stranger@example.com",
        "rox|samuel.private@example.org",
    ] {
        assert!(
            people.iter().all(|(id, _, _)| id != absent),
            "{absent} leaked"
        );
    }
    assert!(search(&pool, "stranger", 50).await.is_empty());
    assert!(search(&pool, "samuel", 50).await.is_empty());
    assert!(search(&pool, "Stranger Label", 50).await.is_empty());
    // The viewer is part of their own directory and their own team.
    assert_eq!(
        search(&pool, "viewer per", 50).await,
        vec![(
            "rox|viewer@example.com".to_string(),
            Some("Viewer Person".to_string()),
            true
        )]
    );
    // A user with no edges and no team finds only themselves.
    let lonely = service(pool.clone())
        .search_people(
            RoxUserIdStr::try_from_email("nobody@example.com").unwrap(),
            &PeopleSearchQuery::new("example").unwrap(),
            PeopleSearchLimit::DEFAULT,
        )
        .await
        .unwrap();
    assert_eq!(
        lonely
            .into_iter()
            .map(|person| (person.contact.user_id.to_string(), person.is_teammate))
            .collect::<Vec<_>>(),
        vec![("rox|nobody@example.com".to_string(), false)]
    );
}

#[sqlx::test(migrator = "ROX_DB_MIGRATIONS")]
async fn limit_is_honoured_and_capped_at_fifty(pool: PgPool) {
    sqlx::query!(
        "INSERT INTO contacts_connections (user1, user2)
         SELECT 'rox|bulk' || lpad(g::text, 3, '0') || '@example.com', 'rox|viewer@example.com'
         FROM generate_series(1, 60) AS g"
    )
    .execute(&pool)
    .await
    .unwrap();
    let three = search(&pool, "bulk", 3).await;
    assert_eq!(
        three
            .iter()
            .map(|(id, _, _)| id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "rox|bulk001@example.com",
            "rox|bulk002@example.com",
            "rox|bulk003@example.com"
        ]
    );
    assert_eq!(search(&pool, "bulk", 50).await.len(), 50);
    assert_eq!(search(&pool, "bulk", 500).await.len(), 50);
}

#[sqlx::test(
    migrator = "ROX_DB_MIGRATIONS",
    fixtures(path = "fixtures", scripts("people_search"))
)]
async fn blank_and_one_character_queries_return_nobody(pool: PgPool) {
    for query in ["", "   ", "s", " e "] {
        assert!(search(&pool, query, 50).await.is_empty(), "{query:?}");
    }
}
