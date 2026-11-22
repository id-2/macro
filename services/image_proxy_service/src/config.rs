use anyhow::Context;
use rox_auth::InternalApiKey;

pub use rox_env::Environment;

/// The configuration parameters for the application.
#[derive(rox_config::RoxConfig)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Config {
    /// The port to listen on.
    #[rox_config_default(8080)]
    pub port: usize,
    /// The environment we are in.
    #[rox_config_default(Environment::new_or_prod())]
    pub environment: Environment,
    /// The internal API key used to authorize service requests.
    pub internal_api_key: InternalApiKey,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        rox_config::ConfigLoader::load::<Config>()
            .context("failed to load image proxy service config")
    }
}
