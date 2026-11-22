use std::collections::HashSet;

use sqlx::{Pool, Postgres};

#[cfg(test)]
mod test;

/// Creates a new user in the database and attaches provided roles
///
/// `rox_user_customer_id` supplies the required legacy account key. Only an
/// actual Stripe customer belongs in the optional profile billing field.
#[expect(clippy::too_many_arguments, reason = "too annoying to fix")]
#[tracing::instrument(skip(db))]
pub async fn create_user(
    db: &Pool<Postgres>,
    id: &str,
    username: &str,
    email: &str,
    is_verified: bool,
    rox_user_customer_id: &str,
    stripe_customer_id: Option<&str>,
    organization_id: Option<i32>,
    roles: HashSet<String>,
    is_agent: bool,
) -> anyhow::Result<String> {
    let id = rox_uuid::string_to_uuid(id)?;

    let mut transaction = db.begin().await?;

    // Create macro user
    let rox_user_id = sqlx::query!(
        r#"
        INSERT INTO "rox_user" (
            "id", "username", "stripe_customer_id", "email", "has_trialed",
            "mailbox_handle_claimed_at"
        )
        VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() ELSE NULL END)
        RETURNING id
        "#,
        &id,
        username,
        rox_user_customer_id,
        email,
        false, // has_trialed
        rox_user_id::handle::MailboxHandle::parse(username).is_ok()
    )
    .map(|row| row.id)
    .fetch_one(&mut *transaction)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO "rox_user_email_verification" ("rox_user_id", "email", "is_verified")
        VALUES ($1, $2, $3)
        "#,
        &id,
        email,
        is_verified
    )
    .execute(&mut *transaction)
    .await?;

    // Create user profile
    let id = format!("rox|{}", email);

    let user_id = sqlx::query!(
        r#"
        INSERT INTO "User" ("id", "email", "stripeCustomerId", "organizationId", "rox_user_id", "isAgent")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        &id,
        email,
        stripe_customer_id,
        organization_id,
        &rox_user_id,
        is_agent
    )
    .map(|row| row.id)
    .fetch_one(&mut *transaction)
    .await?;

    for role in roles {
        sqlx::query!(
            r#"
            INSERT INTO "RolesOnUsers" ("userId", "roleId")
            VALUES ($1, $2)
        "#,
            user_id,
            role
        )
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    Ok(id)
}

/// Links a freshly minted login to a product account that had none.
///
/// A login id lives on `rox_user.id`, and every table that points at a macro
/// user follows that id through `ON UPDATE CASCADE`. Renaming the row is
/// therefore the whole link: the account keeps its roles, documents, email
/// verification and profile, and the new login reaches them.
///
/// `roles` are granted only when the account has none, so an account that was
/// already provisioned never gains entitlements it did not have.
///
/// Returns the profile row `(id, organizationId)` that the new login now owns,
/// or `None` when the account is no longer unclaimed — a concurrent signup
/// linked it first. Callers must treat `None` as "reject the signup".
#[expect(clippy::too_many_arguments, reason = "keeps the whole link in one statement")]
#[tracing::instrument(skip(db, roles))]
pub async fn adopt_rox_user_login(
    db: &Pool<Postgres>,
    unlinked_rox_user_id: &uuid::Uuid,
    new_rox_user_id: &str,
    email: &str,
    is_verified: bool,
    organization_id: Option<i32>,
    roles: HashSet<String>,
) -> anyhow::Result<Option<(String, Option<i32>)>> {
    let new_rox_user_id = rox_uuid::string_to_uuid(new_rox_user_id)?;

    let mut transaction = db.begin().await?;

    let linked = sqlx::query!(
        r#"
        UPDATE "rox_user"
        SET "id" = $1
        WHERE "id" = $2
        "#,
        &new_rox_user_id,
        unlinked_rox_user_id
    )
    .execute(&mut *transaction)
    .await?;

    if linked.rows_affected() == 0 {
        // Another signup renamed the row first; this one keeps its old login.
        return Ok(None);
    }

    sqlx::query!(
        r#"
        INSERT INTO "rox_user_email_verification" ("rox_user_id", "email", "is_verified")
        VALUES ($1, $2, $3)
        ON CONFLICT ("rox_user_id", "email") DO UPDATE
        SET "is_verified" = "rox_user_email_verification"."is_verified" OR EXCLUDED."is_verified"
        "#,
        &new_rox_user_id,
        email,
        is_verified
    )
    .execute(&mut *transaction)
    .await?;

    // The rename cascades into "User"; an account with no profile for this
    // email was never a signup target, so leave the login unlinked.
    let profile = sqlx::query!(
        r#"
        UPDATE "User"
        SET "organizationId" = COALESCE("organizationId", $1)
        WHERE "rox_user_id" = $2
        AND LOWER("email") = LOWER($3)
        RETURNING "id", "organizationId" as "organization_id?"
        "#,
        organization_id,
        &new_rox_user_id,
        email
    )
    .fetch_optional(&mut *transaction)
    .await?;

    let Some(profile) = profile else {
        transaction.rollback().await?;
        return Ok(None);
    };

    let has_roles: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM "RolesOnUsers" WHERE "userId" = $1
        ) as "exists!"
        "#,
        profile.id
    )
    .fetch_one(&mut *transaction)
    .await?;

    if !has_roles {
        for role in roles {
            sqlx::query!(
                r#"
                INSERT INTO "RolesOnUsers" ("userId", "roleId")
                VALUES ($1, $2)
                ON CONFLICT ("userId", "roleId") DO NOTHING
                "#,
                profile.id,
                role
            )
            .execute(&mut *transaction)
            .await?;
        }
    }

    transaction.commit().await?;

    Ok(Some((profile.id, profile.organization_id)))
}

/// Creates a new user profile in the database and attaches provided roles
#[tracing::instrument(skip(db))]
pub async fn create_user_profile(
    db: &Pool<Postgres>,
    id: &str,
    email: &str,
    organization_id: Option<i32>,
    roles: HashSet<String>,
) -> anyhow::Result<()> {
    let rox_user_id = rox_uuid::string_to_uuid(id)?;
    let user_profile_id = format!("rox|{}", email);

    let mut transaction = db.begin().await?;

    let user_id = sqlx::query!(
        r#"
        INSERT INTO "User" ("id", "email", "organizationId", "rox_user_id", "isAgent")
        VALUES (
            $1, $2, $3, $4,
            COALESCE((SELECT BOOL_OR(u."isAgent") FROM "User" u WHERE u.rox_user_id = $4), FALSE)
        )
        RETURNING id
        "#,
        &user_profile_id,
        email,
        organization_id,
        &rox_user_id
    )
    .map(|row| row.id)
    .fetch_one(&mut *transaction)
    .await?;

    for role in roles {
        sqlx::query!(
            r#"
            INSERT INTO "RolesOnUsers" ("userId", "roleId")
            VALUES ($1, $2)
        "#,
            user_id,
            role
        )
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    Ok(())
}
