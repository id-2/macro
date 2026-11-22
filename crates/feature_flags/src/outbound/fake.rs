//! Deterministic, per-user feature flags for consumer tests.

use crate::{FeatureFlags, FlagSnapshot, ServiceContext, ServiceFeatureFlags};
use rox_user_id::user_id::RoxUserIdStr;
use rootcause::Report;
use std::collections::HashMap;

#[cfg(test)]
mod test;

/// A fake loader configured with independent successful or failing user results.
/// Unconfigured users fail explicitly to expose missing test setup.
#[derive(Default)]
pub struct FakeFeatureFlags {
    services: HashMap<ServiceContext, Result<FlagSnapshot, String>>,
    users: HashMap<RoxUserIdStr<'static>, Result<FlagSnapshot, String>>,
}

impl FakeFeatureFlags {
    /// Configure a service result independently of authenticated user results.
    pub fn set_service(&mut self, context: ServiceContext, result: Result<FlagSnapshot, String>) {
        self.services.insert(context, result);
    }
    /// Configure a user's result. An error message simulates a load failure.
    pub fn set(&mut self, user_id: RoxUserIdStr<'static>, result: Result<FlagSnapshot, String>) {
        self.users.insert(user_id, result);
    }
}

impl FeatureFlags for FakeFeatureFlags {
    async fn load(&self, user_id: &RoxUserIdStr<'_>) -> Result<FlagSnapshot, Report> {
        match self.users.get(user_id) {
            Some(Ok(snapshot)) => Ok(snapshot.clone()),
            Some(Err(message)) => Err(rootcause::report!("{message}")),
            None => Err(rootcause::report!(
                "No feature flag result configured for user"
            )),
        }
    }
}

impl ServiceFeatureFlags for FakeFeatureFlags {
    async fn load_service(&self, context: ServiceContext) -> Result<FlagSnapshot, Report> {
        match self.services.get(&context) {
            Some(Ok(snapshot)) => Ok(snapshot.clone()),
            Some(Err(message)) => Err(rootcause::report!("{message}")),
            None => Err(rootcause::report!(
                "No feature flag result configured for service"
            )),
        }
    }
}
