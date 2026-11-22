//! Connection lookups reuse the existing repository methods and their spans.

use super::EmailPgRepo;
use crate::domain::{
    mailbox::connection::ConnectionLinkLookup, models::UserProvider, ports::EmailRepo,
};
use rox_user_id::user_id::RoxUserIdStr;
use uuid::Uuid;

impl ConnectionLinkLookup for EmailPgRepo {
    type Err = sqlx::Error;

    async fn by_identity(
        &self,
        owner: &str,
        actor: RoxUserIdStr<'static>,
    ) -> Result<Option<Uuid>, Self::Err> {
        self.link_by_fusionauth_and_rox_id(owner, actor, UserProvider::Gmail)
            .await
            .map(|link| link.map(|link| link.id))
    }

    async fn by_grant(&self, owner: &str, email: &str) -> Result<Option<Uuid>, Self::Err> {
        self.link_by_fusionauth_email_provider(owner, email, UserProvider::Gmail)
            .await
            .map(|link| link.map(|link| link.id))
    }
}
