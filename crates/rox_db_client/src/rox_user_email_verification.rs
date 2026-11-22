#[tracing::instrument(skip(db))]
pub async fn get_macro_user_email_verification(
    db: &sqlx::Pool<sqlx::Postgres>,
    email: &str,
) -> anyhow::Result<Option<bool>> {
    let result = sqlx::query!(
        r#"
        SELECT "is_verified"
        FROM "rox_user_email_verification"
        WHERE "email" = $1
    "#,
        email
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(|r| r.is_verified))
}

#[tracing::instrument(skip(db))]
pub async fn upsert_macro_user_email_verification(
    db: &sqlx::Pool<sqlx::Postgres>,
    rox_user_id: &str,
    email: &str,
    is_verified: bool,
) -> anyhow::Result<()> {
    let rox_user_id = rox_uuid::string_to_uuid(rox_user_id)?;

    sqlx::query!(
        r#"
        INSERT INTO "rox_user_email_verification" ("rox_user_id", "email", "is_verified")
            VALUES ($1, $2, $3)
        ON CONFLICT ("email") DO UPDATE SET "rox_user_id" = $1, "is_verified" = $3
    "#,
        &rox_user_id,
        email,
        is_verified
    )
    .execute(db)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::{Pool, Postgres};
    use uuid::Uuid;

    #[derive(Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
    struct RoxUserEmailVerification {
        rox_user_id: Uuid,
        email: String,
        is_verified: bool,
    }

    async fn get_macro_user_email_verification(
        pool: &Pool<Postgres>,
        rox_user_id: &str,
        email: &str,
    ) -> anyhow::Result<Option<RoxUserEmailVerification>> {
        let rox_user_id = rox_uuid::string_to_uuid(rox_user_id)?;

        let rox_user_email_verification = sqlx::query_as!(
            RoxUserEmailVerification,
            r#"
            SELECT
                "rox_user_id",
                "email",
                "is_verified"
            FROM "rox_user_email_verification"
            WHERE "rox_user_id" = $1 AND "email" = $2
        "#,
            &rox_user_id,
            &email,
        )
        .fetch_optional(pool)
        .await?;

        Ok(rox_user_email_verification)
    }

    #[sqlx::test]
    async fn test_upsert(pool: Pool<Postgres>) -> anyhow::Result<()> {
        // create macro user
        sqlx::query!(
            r#"
            INSERT INTO "macro_user" ("id", "email", "stripe_customer_id", "username")
            VALUES ($1, $2, $3, $4)
        "#,
            &rox_uuid::string_to_uuid("11111111-1111-1111-1111-111111111111")?,
            "test@rox.one",
            "cus_123",
            "u1",
        )
        .execute(&pool)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO "macro_user" ("id", "email", "stripe_customer_id", "username")
            VALUES ($1, $2, $3, $4)
        "#,
            &rox_uuid::string_to_uuid("22222222-2222-2222-2222-222222222222")?,
            "test2@rox.one",
            "cus_124",
            "u2",
        )
        .execute(&pool)
        .await?;

        let rox_user_id = rox_uuid::string_to_uuid("11111111-1111-1111-1111-111111111111")?;
        let email = "test@rox.one".to_string();
        let is_verified = false;

        upsert_macro_user_email_verification(
            &pool,
            &rox_user_id.to_string(),
            &email,
            is_verified,
        )
        .await?;

        assert_eq!(
            get_macro_user_email_verification(&pool, &rox_user_id.to_string(), &email).await?,
            Some(RoxUserEmailVerification {
                rox_user_id: rox_user_id.clone(),
                email: "test@rox.one".to_string(),
                is_verified: false,
            })
        );

        // update is_verified
        upsert_macro_user_email_verification(&pool, &rox_user_id.to_string(), &email, true)
            .await?;

        assert_eq!(
            get_macro_user_email_verification(&pool, &rox_user_id.to_string(), &email).await?,
            Some(RoxUserEmailVerification {
                rox_user_id: rox_user_id.clone(),
                email: "test@rox.one".to_string(),
                is_verified: true,
            })
        );

        // update rox_user_id
        upsert_macro_user_email_verification(
            &pool,
            "22222222-2222-2222-2222-222222222222",
            &email,
            true,
        )
        .await?;

        assert_eq!(
            get_macro_user_email_verification(
                &pool,
                "22222222-2222-2222-2222-222222222222",
                &email
            )
            .await?,
            Some(RoxUserEmailVerification {
                rox_user_id: rox_uuid::string_to_uuid("22222222-2222-2222-2222-222222222222")?,
                email: "test@rox.one".to_string(),
                is_verified: true,
            })
        );

        Ok(())
    }
}
