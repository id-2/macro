//! The Gmail emulator (`crates/gmail_emulator`).
//!
//! Local sign-in is an emailed code, so the runner does not start this
//! emulator, does not point FusionAuth's login providers at it, and never
//! writes its service-override URLs into the generated env: the emulator is
//! not on the services network, so those URLs would name a host nothing
//! provides.

use std::collections::BTreeMap;

use super::instance::{Instance, Port};
use super::{Mode, kickstart, repo_root};

/// The emulator's Compose service.
pub const SERVICE: &str = "gmail_emulator";
/// The emulator's name on the services network.
const HOST: &str = "gmail-emulator";
const CONTAINER_PORT: u16 = 8080;
/// The seed inside the container.
const SEED_MOUNT: &str = "/etc/gmail-emulator/seed.yaml";
/// The users and mailboxes a stack starts with.
const SEED_FILE: &str = "crates/gmail_emulator/seed.example.yaml";
/// The OAuth client the services and FusionAuth present. It matches the
/// placeholders `BootStubEnv` gives the services; the emulator accepts any.
const CLIENT_ID: &str = "local-google-client";
const CLIENT_SECRET: &str = "local-google-client-secret";

/// Local sign-in does not fake Google, so the runner never starts this emulator.
pub fn stands_in(_mode: Mode, _env: &BTreeMap<String, String>) -> bool {
    false
}

fn in_network(path: &str) -> String {
    format!("http://{HOST}:{CONTAINER_PORT}{path}")
}

/// Google's authorization endpoint as this instance's browser reaches it:
/// the emulator's published port, on the same `localhost` convention as
/// FusionAuth's own hosted pages.
pub fn authorization_endpoint(instance: &Instance) -> String {
    format!(
        "http://localhost:{}/o/oauth2/v2/auth",
        instance.port(Port::GmailEmulator)
    )
}

/// The identity-provider settings that make FusionAuth treat the emulator
/// as Google.
pub fn idp(instance: &Instance) -> kickstart::GoogleIdp {
    kickstart::GoogleIdp {
        client_id: CLIENT_ID.to_string(),
        client_secret: CLIENT_SECRET.to_string(),
        authorization_endpoint: authorization_endpoint(instance),
        token_endpoint: in_network("/token"),
        userinfo_endpoint: in_network("/v1/userinfo"),
    }
}

/// The emulator's command line inside the runtime image. It pushes Gmail
/// watch notifications straight to the email service's webhook, the job the
/// `gmail_forwarder` sidecar does for real Google.
pub fn command() -> Vec<String> {
    [
        "/app/out/gmail_emulator",
        "--listen",
        &format!("0.0.0.0:{CONTAINER_PORT}"),
        "--seed",
        SEED_MOUNT,
        "--push-endpoint",
        "http://email-service:8080/gmail/webhook",
    ]
    .iter()
    .map(|argument| argument.to_string())
    .collect()
}

/// The seed file's bind mount.
pub fn seed_volume() -> String {
    format!("{}:{SEED_MOUNT}:ro", repo_root().join(SEED_FILE).display())
}

/// The published port: `<instance port>:<container port>`.
pub fn published_port(instance: &Instance) -> String {
    format!("{}:{CONTAINER_PORT}", instance.port(Port::GmailEmulator))
}

/// The emulator's network alias.
pub fn network_alias() -> &'static str {
    HOST
}

#[cfg(test)]
mod test;
