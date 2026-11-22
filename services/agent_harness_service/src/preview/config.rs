//! Typed deployment configuration, loaded through rox_env_var by RoxConfig.
use rox_env::Environment;

#[derive(rox_config::RoxConfig)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Config {
    #[rox_config_default(Environment::new_or_prod())]
    pub environment: Environment,
    pub internal_api_key: String,
    /// Persistent OpenSSH ed25519 server private key (Doppler secret).
    pub preview_ssh_host_key: String,
    pub preview_domain: String,
    pub preview_ssh_host: String,
    /// Local stacks only: Cloudflare quick-tunnel hostname fronting the SSH listener,
    /// so an agent running off this machine can still reach it.
    pub preview_ssh_proxy_host: Option<String>,
    #[rox_config_default(22)]
    pub preview_ssh_public_port: u16,
    #[rox_config_default(443)]
    pub preview_https_port: u16,
    #[rox_config_default(8111)]
    pub preview_http_port: u16,
    #[rox_config_default(2222)]
    pub preview_ssh_port: u16,
}
