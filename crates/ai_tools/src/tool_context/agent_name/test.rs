use super::*;
use bots::{
    domain::{models::CreateBotRequest, service::BotServiceImpl},
    outbound::pg_bots_repo::PgBotsRepo,
};
use rox_db_migrator::ROX_DB_MIGRATIONS;
use rox_event_broker::NoopMacroEventBroker;
use rox_user_id::user_id::RoxUserIdStr;
use sqlx::PgPool;

#[sqlx::test(migrator = "ROX_DB_MIGRATIONS")]
async fn agents_are_named_by_their_own_bot_rows(pool: PgPool) -> anyhow::Result<()> {
    let rox_user_id = uuid::Uuid::now_v7();
    sqlx::query(
        "INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES ($1, 'owner@example.com', 'owner@example.com', 'stripe_owner')",
    )
    .bind(rox_user_id)
    .execute(&pool)
    .await?;
    sqlx::query(
        r#"INSERT INTO "User" (id, email, rox_user_id) VALUES ('rox|owner@example.com', 'owner@example.com', $1)"#,
    )
    .bind(rox_user_id)
    .execute(&pool)
    .await?;
    let owner = RoxUserIdStr::try_from("rox|owner@example.com".to_owned())?;

    let bots = BotServiceImpl::new(
        PgBotsRepo::new(pool.clone()),
        NoopMacroEventBroker,
        harnesses::domain::ports::MockHarnessTeamAgents::new(),
    );
    let grunk = bots
        .create_bot(
            owner.clone(),
            CreateBotRequest {
                team_id: None,
                name: "Grunk".to_owned(),
                handle: "grunk".to_owned(),
                description: None,
                avatar_url: None,
                has_agent: Some(true),
            },
        )
        .await?;
    let cursor = bots
        .create_bot(
            owner,
            CreateBotRequest {
                team_id: None,
                name: "Cursor".to_owned(),
                handle: "my-cursor".to_owned(),
                description: None,
                avatar_url: None,
                has_agent: Some(true),
            },
        )
        .await?;

    // Two agents editing the same document are told apart by name.
    assert_eq!(agent_name(&bots, grunk.id).await, Some("Grunk".to_owned()));
    assert_eq!(
        agent_name(&bots, cursor.id).await,
        Some("Cursor".to_owned())
    );
    // First-party bots keep their constant names; no lookup.
    assert_eq!(agent_name(&bots, bot_id::ROX_AI_BOT_ID).await, None);
    // A deleted or unknown agent has no name to present.
    assert_eq!(
        agent_name(&bots, BotId::new_from_uuid(uuid::Uuid::now_v7())).await,
        None
    );
    Ok(())
}
