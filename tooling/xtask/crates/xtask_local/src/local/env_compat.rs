//! Environment variables under their Rox names, with the Rox-era name as a
//! fallback.
//!
//! Local control variables are `ROX_*`. Anything already exported as `ROX_*`
//! (a shell profile, a CI job, an old env file) keeps working: every read tries
//! `ROX_<suffix>` first and only then `ROX_<suffix>`. Nothing new is written
//! under the old prefix.
//!
//! xtask is host tooling: reading the process environment directly is correct,
//! so the workspace's `disallowed_methods` lint is waived here once.
#![allow(clippy::disallowed_methods)]

use std::ffi::OsString;

/// The value of `ROX_<suffix>`, else `ROX_<suffix>`.
pub fn maybe(suffix: &str) -> Option<OsString> {
    let rox = format!("ROX_{suffix}");
    if let Some(value) = std::env::var_os(&rox) {
        return Some(value);
    }
    std::env::var_os(format!("ROX_{suffix}"))
}

/// Whether `ROX_<suffix>` (or its `ROX_` fallback) is set to `1`, the value
/// every local switch has always used.
pub fn flag(suffix: &str) -> bool {
    maybe(suffix).is_some_and(|value| value == "1")
}
