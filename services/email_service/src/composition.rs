//! Shared composition for the HTTP API and background workers.

pub(crate) mod api;
pub mod workers;

use crate::outbound::{
    email_api::{GmailApi, MicrosoftCredentialsClient},
    inbox_health::{PgInboxHealth, ProviderInboxHealth},
};
use contacts::{domain::service::SqsContactsIngress, outbound::ingress::SqsContactsQueue};
use email::{
    domain::mailbox::{credentials::MailboxCredentials, health::InboxHealthService},
    outbound::mailbox_pg::PgMailboxSync,
};
use rox_event_broker::{KafkaEventPublisher, RoxEventBrokerService};
use tokio_util::task::TaskTracker;

pub type InboxLifecycle = email::domain::mailbox::lifecycle::InboxLifecycleService<
    PgMailboxSync,
    crate::outbound::inbox_lifecycle::InboxLifecycleClients,
>;
pub fn inbox_lifecycle(
    outlook: email_api_client::OutlookApiClientRepository,
    db: sqlx::PgPool,
    auth: authentication_service_client::AuthServiceClient,
    queue: sqs_client::SQS,
    gateway: connection_gateway_client::client::ConnectionGatewayClient,
) -> InboxLifecycle {
    email::domain::mailbox::lifecycle::InboxLifecycleService::new(
        PgMailboxSync::new(db),
        crate::outbound::inbox_lifecycle::InboxLifecycleClients {
            outlook,
            auth,
            queue,
            gateway,
        },
    )
}

pub type MicrosoftTokens = MailboxCredentials<PgMailboxSync, MicrosoftCredentialsClient>;
pub type InboxHealth = InboxHealthService<
    PgInboxHealth,
    ProviderInboxHealth<
        MicrosoftTokens,
        RoxEventBrokerService<KafkaEventPublisher, TaskTracker>,
        SqsContactsIngress<SqsContactsQueue>,
    >,
>;

pub fn inbox_health(
    db: sqlx::PgPool,
    gmail: GmailApi,
    auth: authentication_service_client::AuthServiceClient,
    redis: crate::util::redis::RedisClient,
    queue: sqs_client::SQS,
    broker: RoxEventBrokerService<KafkaEventPublisher, TaskTracker>,
    contacts: std::sync::Arc<SqsContactsIngress<SqsContactsQueue>>,
) -> InboxHealth {
    InboxHealthService::new(
        PgInboxHealth {
            db: db.clone(),
            redis,
            queue: queue.clone(),
        },
        ProviderInboxHealth {
            gmail,
            outlook: MicrosoftTokens::new(
                PgMailboxSync::new(db.clone()),
                MicrosoftCredentialsClient(auth),
            ),
            db,
            queue,
            broker,
            contacts,
        },
    )
}

pub type ReadReceipts = email::domain::read_receipts::ReadReceiptService<
    email::outbound::read_receipts_pg::ReadReceiptPgRepository,
>;

/// Pixels point at this service's public URL, which serves `/opens/{token}`.
pub fn read_receipts(
    db: sqlx::PgPool,
    environment: rox_env::Environment,
) -> anyhow::Result<ReadReceipts> {
    let base = rox_service_urls::EmailServiceUrl::new_for_environment(environment)?;
    Ok(email::domain::read_receipts::ReadReceiptService::new(
        email::outbound::read_receipts_pg::ReadReceiptPgRepository(db),
        email::domain::read_receipts::PixelUrlPrefix::new(base.as_str()),
    ))
}
