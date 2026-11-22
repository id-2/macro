//! [`ColleagueDirectory`] adapter backed by the contacts graph.

use contacts::domain::ports::ContactsRepository;
use rox_user_id::user_id::RoxUserIdStr;
use rootcause::Report;

use crate::domain::domain_notice::ColleagueDirectory;

/// Reads a user's contacts from the contacts crate's repository.
pub struct ContactsColleagueDirectory<R> {
    repository: R,
}

impl<R> ContactsColleagueDirectory<R> {
    /// Creates the directory over the contacts repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }
}

impl<R: ContactsRepository> ColleagueDirectory for ContactsColleagueDirectory<R> {
    async fn contacts(
        &self,
        user_id: &RoxUserIdStr<'_>,
    ) -> Result<Vec<RoxUserIdStr<'static>>, Report> {
        self.repository.get_contacts(user_id.clone()).await
    }
}
