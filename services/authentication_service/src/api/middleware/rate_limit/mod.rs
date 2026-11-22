pub mod login_code;
pub mod mobile_welcome_email;
pub mod passwordless;

use rox_env::Environment;

/// Whether the login-code throttles apply to this build.
///
/// On by default via the `rate_limit` feature. `no_rate_limit` is the local
/// opt-out: `just run_local` needs it off (a 1-request/minute login code makes
/// local dev painful), and expressing that as an *additive* feature is what
/// lets every local service binary build in one `cargo` invocation. Turning it
/// off by dropping a default feature instead would need a package-scoped
/// `--no-default-features` build, whose different feature resolution
/// invalidates the shared dependency artifacts of every other binary — a
/// measured ~2 minutes of rebuild on every `run_local`.
pub const RATE_LIMIT_ENABLED: bool =
    cfg!(feature = "rate_limit") && !cfg!(feature = "no_rate_limit");

/// Whether the throttles apply to a request served in `environment`.
///
/// The compile-time [RATE_LIMIT_ENABLED] default, except on a Local stack
/// (`ENVIRONMENT=local`), where local development repeats the same signup and
/// login calls within seconds and must not depend on which artifact was built.
/// Deployed environments never resolve to [Environment::Local], so their
/// behaviour is unchanged.
pub fn rate_limit_applies(environment: Environment) -> bool {
    RATE_LIMIT_ENABLED && !matches!(environment, Environment::Local)
}

#[cfg(test)]
mod test {
    use super::{RATE_LIMIT_ENABLED, rate_limit_applies};
    use rox_env::Environment;

    /// A Local stack never throttles a repeated signup or login call, and the
    /// deployed default is exactly what the build asked for.
    #[test]
    fn local_never_throttles() {
        assert!(!rate_limit_applies(Environment::Local));
        assert_eq!(
            rate_limit_applies(Environment::Production),
            RATE_LIMIT_ENABLED
        );
        assert_eq!(
            rate_limit_applies(Environment::Develop),
            RATE_LIMIT_ENABLED
        );
    }
}
