use anyhow::Context;
use rox_env_var::env_vars;

/// Holds all configuration loaded from environment variables.
pub struct Config {
    pub rox_ids: String,
    pub database_url: String,
}

env_vars! {
    struct RoxIds;
    struct DatabaseUrl;
}

impl Config {
    /// Creates a new `Config` instance by reading from environment variables.
    /// Returns an error if any required variable is not set.
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            rox_ids: RoxIds::new().context("ROX_IDS not set")?.to_string(),
            database_url: DatabaseUrl::new()
                .context("DATABASE_URL not set")?
                .to_string(),
        })
    }
}
