pub async fn upsert_rox_user_id(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: &str,
    rox_user_id: &str,
) -> anyhow::Result<()> {
    let rox_user_id = rox_uuid::string_to_uuid(rox_user_id)?;

    sqlx::query!(
        r#"
        UPDATE "User"
        SET rox_user_id = $2
        WHERE id = $1
        "#,
        user_id,
        &rox_user_id,
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct UserProfileInfo {
    pub industry: Option<String>,
    pub title: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub profile_picture: Option<String>,
    pub profile_picture_hash: Option<String>,
}

pub async fn migrate_rox_user_info(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    fusionauth_user_id: &str,
    user_id: &str,
) -> anyhow::Result<()> {
    let fusionauth_user_id = rox_uuid::string_to_uuid(fusionauth_user_id)?;

    // Get the current user profile info
    // Upsert to rox_user_info table
    // On conflict, do nothing
    //
    let user_profile_info: UserProfileInfo = sqlx::query_as!(
        UserProfileInfo,
        r#"
        SELECT
            industry,
            title,
            "firstName" as first_name,
            "lastName" as last_name,
            "profilePicture" as profile_picture,
            "profilePictureHash" as profile_picture_hash
        FROM "User"
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_one(transaction.as_mut())
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO rox_user_info (rox_user_id, industry, title, first_name, last_name, profile_picture, profile_picture_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (rox_user_id) DO NOTHING
        "#,
        &fusionauth_user_id,
        user_profile_info.industry,
        user_profile_info.title,
        user_profile_info.first_name,
        user_profile_info.last_name,
        user_profile_info.profile_picture,
        user_profile_info.profile_picture_hash,
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}
