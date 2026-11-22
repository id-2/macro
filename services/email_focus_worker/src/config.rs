//! Configuration for the email focus worker, loaded with `rox_config` from
//! the email-service Doppler project it shares with the other email binaries.

use rox_auth::InternalApiKey;
pub use rox_env::Environment;
use rox_env_var::env_vars;

env_vars! {
    /// The connection URL for the Rox database.
    pub struct RoxDbUrl;
    /// Comma-separated Kafka bootstrap servers for the macro event broker.
    pub struct KafkaBrokers;
}

/// The email focus worker's configuration.
#[derive(rox_config::RoxConfig)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Config {
    /// The environment we are in.
    #[rox_config_default(Environment::new_or_prod())]
    pub environment: Environment,
    /// The connection URL for the Rox database.
    pub rox_db_url: RoxDbUrl,
    /// Kafka bootstrap servers; the worker reads `macro.email`.
    pub kafka_brokers: KafkaBrokers,
    /// Authenticates the worker's pushes to the connection gateway.
    pub internal_api_key: InternalApiKey,
    /// TypeSafe credential for Jev. While it is unset the worker classifies nothing.
    pub typesafe_api_key: jev::outbound::TypesafeApiKey,
    /// Comma-separated inbox domains to classify, e.g. `rox.one`. Mail from
    /// any other inbox never leaves the system. Empty classifies nothing.
    #[rox_config_default(String::new())]
    pub focus_enabled_email_domains: String,
    /// Seconds between sweeps for threads the event stream missed.
    #[rox_config_default(3600)]
    pub focus_sweep_interval_secs: u64,
    /// Days of mail the sweep and the Focus list cover.
    #[rox_config_default(30)]
    pub focus_window_days: u16,
}

impl Config {
    /// Load and validate the configuration from the environment.
    pub fn from_env() -> Result<Self, rootcause::Report> {
        Ok(rox_config::ConfigLoader::load::<Config>()?)
    }

    /// The allowlisted inbox domains, trimmed and lowercased.
    pub fn enabled_domains(&self) -> Vec<String> {
        self.focus_enabled_email_domains
            .split(',')
            .map(|domain| domain.trim().to_lowercase())
            .filter(|domain| !domain.is_empty())
            .collect()
    }
}
