//! # Attachment Backfill Utility
//!
//! This binary is used to find and upload image/video email attachments for a given user account.
//! It fetches attachment metadata from the local database, downloads the actual attachment data
//! from Gmail, and uploads it to SFS.
//!
//! ## Required Environment Variables:
//! - `DATABASE_URL`: The connection string for the PostgreSQL database.
//! - `SFS_URL`: The URL for the Static File Service.
//! - `INTERNAL_AUTH_KEY`: An access token for authenticating with internal Rox services.
//! - `ROX_IDS`: The Rox IDs of the user accounts to backfill attachments for
//! - `UPLOAD_CONCURRENCY`: Number of concurrent uploads to process (optional, defaults to 10).
//! - `FUSIONAUTH_API_KEY`: The API key for authenticating with FusionAuth.
//! - `FUSIONAUTH_BASE_URL`: The base URL for the FusionAuth service.
//! - `FUSIONAUTH_IDENTITY_PROVIDER_ID`: The identity provider ID for FusionAuth.
//! - `GMAIL_CLIENT_ID`: The client ID for Gmail OAuth.
//! - `GMAIL_CLIENT_SECRET`: The client secret for Gmail OAuth.

mod auth;
mod config;
mod database;
mod process;
mod upload;

use anyhow::Context;
use rox_entrypoint::RoxEntrypoint;
use sqlx_core::types::chrono;
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Loading configuration...");
    RoxEntrypoint::default().init();
    let config = config::Config::from_env().context("Failed to load configuration")?;

    println!("Connecting to the database...");
    let db_pool = database::create_db_pool(&config.database_url, config.upload_concurrency as u32)
        .await
        .context("Failed to create database pool")?;

    let sfs_client = static_file_service_client::StaticFileServiceClient::new(
        config.internal_auth_key.clone(),
        config.sfs_url.clone(),
    );

    let email_api_repository =
        email_api_client::GmailApiClientRepository::from_subscription_topic("unused");

    let rox_ids: Vec<String> = config
        .rox_ids
        .split(',')
        .map(|id| id.trim().to_string())
        .collect();

    println!("Processing {} macro IDs: {:?}", rox_ids.len(), rox_ids);

    for (index, rox_id) in rox_ids.iter().enumerate() {
        println!(
            "\n=== Processing macro ID {} ({}/{}) at {} ===",
            rox_id,
            index + 1,
            rox_ids.len(),
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
        );

        match process::process_rox_id(
            &config,
            &db_pool,
            &sfs_client,
            &email_api_repository,
            rox_id,
        )
        .await
        {
            Ok((success_count, total_attachments)) => {
                println!(
                    "Completed processing for {}. Successfully uploaded {} out of {} attachments.",
                    rox_id, success_count, total_attachments
                );
            }
            Err(e) => {
                println!("Failed to process macro ID {}: {:?}", rox_id, e);
                // Continue with next macro ID instead of failing completely
            }
        }
    }

    println!("\n=== All macro IDs processed ===");
    Ok(())
}
