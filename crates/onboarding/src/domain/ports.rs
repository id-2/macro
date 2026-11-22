//! Ports (traits) the onboarding domain depends on.

use super::models::{OnboardingRow, PromptId};
use rox_user_id::user_id::RoxUserIdStr;
use thiserror::Error;

/// Errors surfaced by the onboarding service and repository.
#[derive(Debug, Error)]
pub enum OnboardingError {
    /// Database failure.
    #[error("database error: {0}")]
    Db(rootcause::Report),
    /// Anything else.
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

/// Result alias for onboarding operations.
pub type Result<T> = std::result::Result<T, OnboardingError>;

/// Persistence for the onboarding row.
pub trait OnboardingRepo: Send + Sync + 'static {
    /// Fetch the user's onboarding row, creating an `active` one on first
    /// touch.
    fn ensure_row(
        &self,
        user: &RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<OnboardingRow>> + Send;

    /// Fetch the user's onboarding row without creating one. `None` means
    /// the user never entered the flow.
    fn get_row(
        &self,
        user: &RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<Option<OnboardingRow>>> + Send;

    /// Mark the flow completed (idempotent; keeps the earliest completion).
    fn complete(
        &self,
        user: &RoxUserIdStr<'static>,
        skipped: bool,
    ) -> impl Future<Output = Result<OnboardingRow>> + Send;

    /// Remove the user's onboarding row and dismissed prompts, for account
    /// deletion. Idempotent: a user who never entered the flow (or whose
    /// data is already gone from an earlier attempt) is not an error.
    fn delete_row(&self, user: &RoxUserIdStr<'static>)
    -> impl Future<Output = Result<()>> + Send;

    /// The prompt ids the user dismissed, oldest first.
    fn dismissed_prompts(
        &self,
        user: &RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Record a dismissal (idempotent; keeps the first dismissal time).
    fn dismiss_prompt(
        &self,
        user: &RoxUserIdStr<'static>,
        prompt: &PromptId,
    ) -> impl Future<Output = Result<()>> + Send;
}
