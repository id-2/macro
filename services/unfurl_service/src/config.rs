use anyhow::Context;

pub use rox_env::Environment;

/// The configuration parameters for the application.
///
/// These can either be passed on the command line, or pulled from environment variables.
/// The latter is preferred as environment variables are one of the recommended ways to
/// populate the Docker container
///
/// See `.env.sample` in cognitive-workspace root for details.
#[derive(rox_config::RoxConfig)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Config {
    /// The port to listen for HTTP requests on.
    #[rox_config_default(8080)]
    pub port: usize,

    /// The environment we are in
    #[rox_config_default(Environment::new_or_prod())]
    pub environment: Environment,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        rox_config::ConfigLoader::load::<Config>().context("failed to load unfurl service config")
    }
}
