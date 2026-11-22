//! This crate contains the rox_env_var structs for our databases.
//! This allows us to standardize how we configure a service to use these databases.
//! Each value in this crate should match the key name of the environment variable you provide in
//! the doppler configuration.
#![deny(missing_docs)]

use rox_env_var::env_vars;

env_vars! {
/// RoxDB database url
pub struct DatabaseUrl;
/// RoxCache redis uri
pub struct RedisUri;
}
