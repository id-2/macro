use crate::{ColleagueJoinedRox, InviteToTeamMetadata, NewEmailMetadata};
use invite_email::InviteToRox;
use notification::domain::models::email_notification_digest::{
    EmailBlockList, NotificationSetBuilder,
};

#[cfg(test)]
mod test;

/// define a blocklist of notification types which will never be templated into a digest email
pub fn digest_email_block_list() -> EmailBlockList {
    EmailBlockList::new::<NewEmailMetadata>()
        .append::<InviteToTeamMetadata>()
        .append::<InviteToRox>()
        .append::<invite_email::CallInvite>()
        .append::<ColleagueJoinedRox>()
}
