use feature_flags::FeatureFlags;
use rox_user_id::user_id::RoxUserIdStr;

use crate::domain::ports::ProgrammaticCallGate;

const ENABLE_PROGRAMMATIC_CALLS: &str = "enable-programmatic-calls";

/// Environment variable that overrides the local default for programmatic calls.
pub const LOCAL_ENABLE_PROGRAMMATIC_CALLS: &str = "LOCAL_ENABLE_PROGRAMMATIC_CALLS";

/// Evaluates the server-side call switch for each authenticated account.
pub struct FlaggedProgrammaticCalls<F>(pub F);

#[async_trait::async_trait]
impl<F: FeatureFlags + Send + Sync + 'static> ProgrammaticCallGate for FlaggedProgrammaticCalls<F> {
    async fn enabled_for(&self, caller: RoxUserIdStr<'_>) -> bool {
        match self.0.load(&caller).await {
            Ok(flags) => flags.is_enabled(ENABLE_PROGRAMMATIC_CALLS),
            Err(error) => {
                tracing::warn!(error = ?error, "failed to load programmatic call flag");
                false
            }
        }
    }
}

/// Local-deployment switch: the hosted flag service is not reachable from a
/// Local deployment, so the decision comes from configuration instead.
///
/// Enabled by default; `LOCAL_ENABLE_PROGRAMMATIC_CALLS` (`false`, `0`, `no`,
/// `off`) turns the programmatic call routes off for every caller.
pub struct LocalProgrammaticCalls {
    enabled: bool,
}

impl LocalProgrammaticCalls {
    /// Use an explicit decision, bypassing the environment.
    pub const fn new(enabled: bool) -> Self {
        Self { enabled }
    }

    /// Resolve the switch once from `LOCAL_ENABLE_PROGRAMMATIC_CALLS`.
    ///
    /// An absent or unrecognized value keeps the local default of enabled.
    pub fn from_env() -> Self {
        Self::new(local_default_from(std::env::var(LOCAL_ENABLE_PROGRAMMATIC_CALLS).ok()))
    }
}

impl Default for LocalProgrammaticCalls {
    fn default() -> Self {
        Self::from_env()
    }
}

#[async_trait::async_trait]
impl ProgrammaticCallGate for LocalProgrammaticCalls {
    async fn enabled_for(&self, _caller: RoxUserIdStr<'_>) -> bool {
        self.enabled
    }
}

/// The local default, overridable by an explicitly disabling environment value.
fn local_default_from(value: Option<String>) -> bool {
    match value {
        Some(value) => !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "false" | "0" | "no" | "off"
        ),
        None => true,
    }
}

#[cfg(test)]
mod test;
