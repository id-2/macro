use sqlx::types::Uuid;

/// Flags every thread on one of the user's links that has a PDF, image or
/// document attachment. One statement per link keeps transactions small and
/// the progress output per-mailbox. Returns the number of threads updated.
pub async fn process_rox_id(pool: &sqlx::PgPool, rox_id: &str) -> anyhow::Result<u64> {
    let link_ids: Vec<Uuid> =
        sqlx::query_scalar!("SELECT id FROM email_links WHERE rox_id = $1", rox_id)
            .fetch_all(pool)
            .await?;

    if link_ids.is_empty() {
        println!("No email links found for {rox_id}.");
        return Ok(0);
    }

    let mut total_flagged = 0u64;
    for link_id in link_ids {
        let flagged =
            email_db_client::threads::update::backfill_link_attachment_kind_flags(pool, link_id)
                .await?;

        // Prefix with the user so interleaved concurrent output stays readable.
        println!("[{rox_id}] link {link_id}: flagged {flagged} threads");
        total_flagged += flagged;
    }

    Ok(total_flagged)
}

/// Every macro ID that owns at least one email link. Connected secondary
/// mailboxes carry their own rox_id row in email_links, so iterating these
/// covers every link exactly once.
pub async fn fetch_all_rox_ids(pool: &sqlx::PgPool) -> anyhow::Result<Vec<String>> {
    Ok(
        sqlx::query_scalar!("SELECT DISTINCT rox_id FROM email_links ORDER BY rox_id")
            .fetch_all(pool)
            .await?,
    )
}
