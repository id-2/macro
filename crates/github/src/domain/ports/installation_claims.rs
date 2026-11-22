//! Who may see what a GitHub App installation delivers.

use std::future::Future;

use rox_user_id::user_id::RoxUserIdStr;

use crate::domain::models::GithubError;

/// What GitHub a user reaches through their currently linked account.
pub trait GithubInstallationClaims: Send + Sync + 'static {
    /// Whether `user` has linked a GitHub account.
    fn is_linked(
        &self,
        user: &RoxUserIdStr<'_>,
    ) -> impl Future<Output = Result<bool, GithubError>> + Send;

    /// Whether `user`, while linked, has a claim to the installation: a team
    /// they belong to installed it, or they installed it with the GitHub
    /// account linked now. False for an installation Rox has no record of.
    fn has_claim(
        &self,
        user: &RoxUserIdStr<'_>,
        installation_id: u64,
    ) -> impl Future<Output = Result<bool, GithubError>> + Send;
}
