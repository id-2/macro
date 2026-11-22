#[cfg(test)]
mod test;

pub mod get_user_by_email;
pub mod get_user_organization;
pub mod get_user_permissions;

mod get_legacy_user_info;
pub use get_legacy_user_info::{LegacyUserInfo, get_legacy_user_info};
use rox_user_id::{lowercased::Lowercase, user_id::RoxUserId};
use model::user::{UserInfo, UserInfoWithMacroUserId};

/// Gets the stripe customer id for a given user id
#[tracing::instrument(skip(db))]
pub async fn get_stripe_customer_id_by_user_id(
    db: &sqlx::Pool<sqlx::Postgres>,
    user_id: &RoxUserId<Lowercase<'_>>,
) -> Result<Option<String>, sqlx::Error> {
    let user_id = user_id.as_ref();

    let stripe_customer_id = sqlx::query!(
        r#"
        SELECT "stripeCustomerId" as "stripe_customer_id?"
        FROM "User"
        WHERE "id" = $1
        "#,
        user_id
    )
    .map(|row| row.stripe_customer_id)
    .fetch_one(db)
    .await?;

    Ok(stripe_customer_id)
}

/// Gets the user macro id for a given email
#[tracing::instrument(skip(db))]
pub async fn get_user_rox_id_by_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<String, sqlx::Error> {
    let rox_user_id: String = sqlx::query!(
        r#"
        SELECT "rox_user_id" as "rox_user_id!"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .map(|row| row.rox_user_id.to_string())
    .fetch_one(db)
    .await?;

    Ok(rox_user_id)
}

/// Gets the user id for a given email
#[tracing::instrument(skip(db))]
pub async fn get_user_id_by_email(
    db: sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<String, sqlx::Error> {
    let user_id: String = sqlx::query!(
        r#"
        SELECT "id"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .map(|row| row.id)
    .fetch_one(&db)
    .await?;

    Ok(user_id)
}

/// Returns the `rox_user_id` (FusionAuth uuid) tied to a User row by email, if any.
/// Used to distinguish "this email belongs to the same macro user" from a true cross-user
/// account merge.
#[tracing::instrument(skip(db))]
pub async fn get_rox_user_id_by_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<Option<uuid::Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT "rox_user_id"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .fetch_optional(db)
    .await
}

/// A product account that already owns an email, read before signup decides
/// whether that email may claim the account.
#[derive(Debug, Clone)]
pub struct ExistingUserForSignup {
    /// The `User` row id, `macro|{email}` for accounts created by signup.
    pub id: String,
    /// The account's linked login: the FusionAuth user id.
    pub rox_user_id: uuid::Uuid,
    /// The organization the profile belongs to, if any.
    pub organization_id: Option<i32>,
    /// The Stripe customer the profile was created with, if any.
    pub stripe_customer_id: Option<String>,
}

/// Returns the product account that owns `email`, if one exists.
///
/// Signup uses this to tell an email whose account has no login yet (adoptable)
/// from one already linked to a different login (rejected).
#[tracing::instrument(skip(db))]
pub async fn get_existing_user_for_signup(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<Option<ExistingUserForSignup>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT
            "id",
            "rox_user_id",
            "organizationId" as "organization_id?",
            "stripeCustomerId" as "stripe_customer_id?"
        FROM "User"
        WHERE LOWER("email") = LOWER($1)
        ORDER BY "createdAt" ASC NULLS LAST
        LIMIT 1
        "#,
        email
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|row| ExistingUserForSignup {
        id: row.id,
        rox_user_id: row.rox_user_id,
        organization_id: row.organization_id,
        stripe_customer_id: row.stripe_customer_id,
    }))
}

/// Gets the user id and stripe customer id for a given email
#[tracing::instrument(skip(db))]
pub async fn get_user_id_and_stripe_customer_id_by_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<(String, Option<String>), sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT "id", "stripeCustomerId" as "stripe_customer_id?"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .map(|row| (row.id, row.stripe_customer_id))
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Returns the user profile for a given macro user and email
pub async fn get_user_profile_by_fusionauth_user_id_and_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    fusionauth_user_id: &str,
    email: &str,
) -> anyhow::Result<Option<(String, Option<i32>)>> {
    let fusionauth_user_id = rox_uuid::string_to_uuid(fusionauth_user_id)?;
    let profile = sqlx::query!(
        r#"
        SELECT id, "organizationId" as "organization_id?"
        FROM "User"
        WHERE "rox_user_id" = $1
        AND LOWER(email) = LOWER($2)
        "#,
        &fusionauth_user_id,
        &email
    )
    .map(|row| (row.id, row.organization_id))
    .fetch_optional(db)
    .await?;

    Ok(profile)
}

/// Returns all the user profiles for a given macro user
pub async fn get_user_profiles_by_fusionauth_user_id(
    db: &sqlx::Pool<sqlx::Postgres>,
    fusionauth_user_id: &str,
) -> anyhow::Result<Vec<String>> {
    let fusionauth_user_id = rox_uuid::string_to_uuid(fusionauth_user_id)?;
    let profiles = sqlx::query!(
        r#"
        SELECT id
        FROM "User"
        WHERE "rox_user_id" = $1
        "#,
        &fusionauth_user_id
    )
    .map(|row| row.id)
    .fetch_all(db)
    .await?;

    Ok(profiles)
}

/// Gets the user profile by email
#[tracing::instrument(skip(db))]
pub async fn get_user_info_by_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<UserInfoWithMacroUserId, sqlx::Error> {
    let user_info = sqlx::query_as!(
        UserInfoWithMacroUserId,
        r#"
        SELECT 
            id,
            email,
            "organizationId" as "organization_id?",
            rox_user_id as "rox_user_id?"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .fetch_one(db)
    .await?;

    Ok(user_info)
}

/// Gets the user profile
#[tracing::instrument(skip(db))]
pub async fn get_user_profile(
    db: &sqlx::Pool<sqlx::Postgres>,
    user_id: &str,
) -> Result<UserInfo, sqlx::Error> {
    let user_info = sqlx::query_as!(
        UserInfo,
        r#"
        SELECT 
            id,
            email,
            "organizationId" as "organization_id?"
        FROM "User"
        WHERE "id" = $1
        "#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(user_info)
}

/// Gets the user's rox_user_id (UUID) and id (RoxUserIdStr) by email
#[tracing::instrument(skip(db), err)]
pub async fn get_user_rox_user_id_and_id_by_email(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> Result<(uuid::Uuid, String), sqlx::Error> {
    sqlx::query!(
        r#"
        SELECT "rox_user_id" as "rox_user_id!", "id"
        FROM "User"
        WHERE "email" = $1
        "#,
        email
    )
    .map(|row| (row.rox_user_id, row.id))
    .fetch_one(db)
    .await
}

/// Gets all users emails
#[tracing::instrument(skip(db))]
pub async fn get_user_emails(
    db: sqlx::Pool<sqlx::Postgres>,
    limit: i64,
    offset: i64,
) -> anyhow::Result<(Vec<String>, i64)> {
    let count = sqlx::query!(
        r#"
            SELECT COUNT(*) as "count"
            FROM "User" u
        "#,
    )
    .map(|row| row.count)
    .fetch_one(&db)
    .await?;

    let count = count.unwrap_or(0);

    if count == 0 {
        tracing::trace!("no users found");
        return Ok((vec![], 0));
    }

    // Get batch of users
    let users = sqlx::query!(
        r#"
        SELECT
            u.email
        FROM
            "User" u
        LIMIT $1 OFFSET $2
    "#,
        limit,
        offset,
    )
    .map(|row| row.email)
    .fetch_all(&db)
    .await?;

    Ok((users, count))
}
