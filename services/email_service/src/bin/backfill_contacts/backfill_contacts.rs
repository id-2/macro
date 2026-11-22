mod config;
mod process;

use anyhow::Context;
use rox_entrypoint::RoxEntrypoint;
use sqlx::postgres::PgPoolOptions;
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Loading configuration...");
    RoxEntrypoint::default().init();
    let config = config::Config::from_env().context("Failed to load configuration")?;

    println!("Connecting to the database...");
    let db_pool = PgPoolOptions::new()
        .min_connections(5)
        .max_connections(60)
        .connect(&config.database_url)
        .await
        .context("Could not connect to db")?;

    let rox_ids: Vec<String> = config
        .rox_ids
        .split(',')
        .map(|id| id.trim().to_string())
        .collect();

    let aws_config = rox_aws_config::get_rox_aws_config().await;

    let contacts_ingress = contacts::domain::service::SqsContactsIngress {
        queue: contacts::outbound::ingress::SqsContactsQueue::new(
            aws_sdk_sqs::Client::new(&aws_config),
            rox_queues::ContactsQueue::new().to_string(),
        ),
    };

    println!("Processing {} macro IDs: {:?}", rox_ids.len(), rox_ids);

    for (index, rox_id) in rox_ids.iter().enumerate() {
        println!(
            "\n=== Processing macro ID {} ({}/{}) ===",
            rox_id,
            index + 1,
            rox_ids.len()
        );

        match process::process_rox_id(&db_pool, &contacts_ingress, rox_id).await {
            Ok(()) => {
                println!("Completed processing for {}.", rox_id);
            }
            Err(e) => {
                panic!("Failed to process macro ID {}: {:?}", rox_id, e);
            }
        }
    }

    println!("\n=== All macro IDs processed ===");
    Ok(())
}
