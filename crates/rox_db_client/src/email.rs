use rox_user_id::user_id::RoxUserIdStr;

/// Check if email link exists for user
#[tracing::instrument(skip(db))]
pub async fn check_user_email_link(
    db: &sqlx::Pool<sqlx::Postgres>,
    rox_user_id: &RoxUserIdStr<'static>,
) -> anyhow::Result<bool> {
    let link_id = sqlx::query!(
        r#"
    SELECT id FROM email_links
    WHERE rox_id = $1
    "#,
        rox_user_id.as_ref()
    )
    .map(|row| row.id)
    .fetch_optional(db)
    .await?;

    Ok(link_id.is_some())
}
