use std::collections::HashSet;

use rox_user_id::cowlike::CowLike;
use rox_user_id::user_id::RoxUserIdStr;
use notification::domain::ports::RealtimeSender;
use rootcause::Report;
use serde::Serialize;

/// Realtime sender that logs delivery info instead of sending.
pub struct LoggingRealtimeSender;

impl RealtimeSender for LoggingRealtimeSender {
    async fn send_notifications<'a, T: Serialize + Send + Sync>(
        &self,
        recipients: &[RoxUserIdStr<'a>],
        _notification: &T,
    ) -> Result<HashSet<RoxUserIdStr<'static>>, Report> {
        println!(
            "  [egress] Realtime: delivered to {} recipient(s)",
            recipients.len()
        );
        Ok(recipients.iter().map(|r| r.clone().into_owned()).collect())
    }
}
