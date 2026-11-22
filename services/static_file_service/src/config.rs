use anyhow::Context;
use rox_auth::InternalApiKey;
pub use rox_env::Environment;
use rox_env_var::env_vars;

env_vars! {
    pub struct StaticFileServiceDynamodbTableName;
    pub struct StaticStorageBucket;
}

#[derive(rox_config::RoxConfig)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Config {
    /// self explanatory
    #[macro_config_default(Environment::new_or_prod())]
    pub environment: Environment,
    /// port (8080)
    #[macro_config_default(8080)]
    pub port: usize,
    /// the tablename of the metadata table
    pub static_file_service_dynamodb_table_name: StaticFileServiceDynamodbTableName,
    /// s3 storage bucket
    pub static_storage_bucket: StaticStorageBucket,
    /// Internal API key
    pub internal_api_key: InternalApiKey,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        rox_config::ConfigLoader::load::<Config>()
            .context("failed to load static file service config")
    }
}
