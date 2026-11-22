use super::*;
use rox_db_migrator::ROX_DB_MIGRATIONS;

fn inbox_address() -> String {
    format!("ada@{}", rox_user_id::handle::ROX_MAIL_DOMAIN)
}

async fn insert_rox_link(pool: &PgPool) -> (Uuid, String) {
    let link_id = Uuid::now_v7();
    let address = inbox_address();
    let rox_id = format!("rox|{address}");
    sqlx::query(
        "INSERT INTO email_links (id, rox_id, fusionauth_user_id, email_address, provider)
         VALUES ($1, $2, $3, $4, 'ROX'::email_user_provider_enum)",
    )
    .bind(link_id)
    .bind(&rox_id)
    .bind(Uuid::now_v7().to_string())
    .bind(&address)
    .execute(pool)
    .await
    .unwrap();
    (link_id, address)
}

fn received(to: &str, message_id: &str) -> InboundMessage {
    InboundMessage {
        message_id: format!("<{message_id}>"),
        sender: InboundAddress {
            email: "sender@example.com".into(),
            name: Some("Sender".into()),
        },
        recipients: vec![InboundAddress {
            email: to.into(),
            name: None,
        }],
        subject: Some("Hello".into()),
        body_text: Some("Plain body".into()),
        body_html: Some("<p>Plain body</p>".into()),
        received_at: Utc::now(),
        in_reply_to: None,
        mailbox: None,
    }
}

/// Everything the inbox preview query reads: the thread is visible in the
/// inbox with an inbound timestamp, and the message is present and in the
/// inbox in the mailbox facts view.
async fn inbox_state(pool: &PgPool, message_db_id: Uuid) -> (bool, bool, bool, bool) {
    #[derive(sqlx::FromRow)]
    struct InboxRow {
        inbox_visible: bool,
        latest_inbound_message_ts: Option<DateTime<Utc>>,
        in_inbox: bool,
        is_present: bool,
    }
    sqlx::query_as::<_, InboxRow>(
        "SELECT t.inbox_visible, t.latest_inbound_message_ts, f.in_inbox, f.is_present
         FROM email_messages m
         JOIN email_threads t ON t.id = m.thread_id
         JOIN email_message_mailbox_facts f ON f.id = m.id
         WHERE m.id = $1",
    )
    .bind(message_db_id)
    .fetch_one(pool)
    .await
    .map(|row| {
        (
            row.inbox_visible,
            row.latest_inbound_message_ts.is_some(),
            row.in_inbox,
            row.is_present,
        )
    })
    .unwrap()
}

#[sqlx::test(migrator = "ROX_DB_MIGRATIONS")]
async fn a_message_reaches_the_inbox_and_a_second_delivery_writes_no_row(pool: PgPool) {
    let (link_id, address) = insert_rox_link(&pool).await;
    let prepared = received(&address, "root@example.com").validate().unwrap();

    let first = ingest(&pool, &prepared).await.unwrap();
    assert_eq!(first.link_id, link_id);
    assert!(!first.duplicate);
    assert_eq!(
        inbox_state(&pool, first.message_db_id).await,
        (true, true, true, true)
    );

    let second = ingest(&pool, &prepared).await.unwrap();
    assert!(second.duplicate);
    assert_eq!(second.message_db_id, first.message_db_id);
    assert_eq!(second.thread_id, first.thread_id);
    let rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM email_messages WHERE link_id = $1 AND provider_id = $2",
    )
    .bind(link_id)
    .bind("root@example.com")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(rows, 1);
}

#[sqlx::test(migrator = "ROX_DB_MIGRATIONS")]
async fn a_reply_with_in_reply_to_joins_the_answered_thread(pool: PgPool) {
    let (_, address) = insert_rox_link(&pool).await;
    let root = ingest(
        &pool,
        &received(&address, "root@example.com").validate().unwrap(),
    )
    .await
    .unwrap();

    let mut reply = received(&address, "reply@example.com");
    reply.in_reply_to = Some("<root@example.com>".into());
    let reply = ingest(&pool, &reply.validate().unwrap()).await.unwrap();

    assert_eq!(reply.thread_id, root.thread_id);
    let replying_to: Option<Uuid> =
        sqlx::query_scalar("SELECT replying_to_id FROM email_messages WHERE id = $1")
            .bind(reply.message_db_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(replying_to, Some(root.message_db_id));
}

#[sqlx::test(migrator = "ROX_DB_MIGRATIONS")]
async fn a_recipient_without_a_rox_mailbox_is_rejected(pool: PgPool) {
    insert_rox_link(&pool).await;
    let prepared = received("nobody@example.com", "lost@example.com")
        .validate()
        .unwrap();
    assert!(matches!(
        ingest(&pool, &prepared).await,
        Err(IngestError::MailboxNotFound)
    ));
}

#[test]
fn message_ids_drop_their_optional_angle_brackets() {
    assert_eq!(
        normalize_message_id(" <a@b.example> ").unwrap(),
        "a@b.example"
    );
    assert_eq!(normalize_message_id("a@b.example").unwrap(), "a@b.example");
    assert!(normalize_message_id("  ").is_err());
    assert!(normalize_message_id("a b@example.com").is_err());
}
