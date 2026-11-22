/// Creates a new macro user in the database
#[tracing::instrument(skip(transaction))]
pub async fn create_rox_user(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    fusionauth_user_id: &str,
    username: &str,
    stripe_customer_id: &str,
    email: &str,
) -> anyhow::Result<()> {
    let fusionauth_user_id = rox_uuid::string_to_uuid(fusionauth_user_id)?;

    sqlx::query!(
        r#"
        INSERT INTO rox_user (id, username, stripe_customer_id, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
        "#,
        &fusionauth_user_id,
        username,
        stripe_customer_id,
        email
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct RoxUser {
    pub id: uuid::Uuid,
    pub username: String,
    pub stripe_customer_id: Option<String>,
}

/// Gets the macro user
pub async fn get_rox_user(
    db: &sqlx::Pool<sqlx::Postgres>,
    id: &str,
) -> anyhow::Result<RoxUser> {
    let id = rox_uuid::string_to_uuid(id)?;

    let result = sqlx::query_as!(
        RoxUser,
        r#"
        SELECT id, username, stripe_customer_id
        FROM rox_user
        WHERE id = $1
        "#,
        &id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

pub async fn delete_rox_user(
    db: &sqlx::Pool<sqlx::Postgres>,
    id: &uuid::Uuid,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        DELETE FROM rox_user
        WHERE id = $1
        "#,
        id
    )
    .execute(db)
    .await?;

    Ok(())
}

#[tracing::instrument(skip(db))]
pub async fn check_email_exists(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> anyhow::Result<bool> {
    let result = sqlx::query!(
        r#"
        SELECT id
        FROM "User"
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(db)
    .await?;

    Ok(result.is_some())
}

#[tracing::instrument(skip(db))]
pub async fn check_username_exists(
    db: &sqlx::Pool<sqlx::Postgres>,
    username: &str,
) -> anyhow::Result<bool> {
    let result = sqlx::query!(
        r#"
        SELECT id
        FROM rox_user
        WHERE lower(username) = lower($1)
          AND mailbox_handle_claimed_at IS NOT NULL
        "#,
        username
    )
    .fetch_optional(db)
    .await?;

    Ok(result.is_some())
}
