use chrono::{DateTime, Utc};
use rox_user_id::user_id::RoxUserIdStr;
use rootcause::Report;

pub trait SystemTime: Send + Sync + 'static {
    fn now(&self) -> DateTime<Utc>;
}

pub trait LastOnlineRepo: Send + Sync + 'static {
    fn set_last_online(
        &self,
        user: RoxUserIdStr<'_>,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), Report>> + Send;

    fn get_last_online(
        &self,
        user: RoxUserIdStr<'_>,
    ) -> impl Future<Output = Result<Option<DateTime<Utc>>, Report>> + Send;
}
