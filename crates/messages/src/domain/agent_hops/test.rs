use super::*;

use rox_user_id::cowlike::CowLike as _;
use rox_user_id::user_id::RoxUserIdStr;

#[test]
fn bots_answering_each_other_count_one_hop_per_turn_since_the_last_person() {
    let person = ChannelSender::new_from_user(
        RoxUserIdStr::parse_from_str("macro|hops@rox.one")
            .expect("a valid user id")
            .into_owned(),
    );
    let rox_ai = ChannelSender::new_from_bot(bot_id::ROX_NEW_BOT_ID);
    let cursor = ChannelSender::new_from_bot(bot_id::CURSOR_BOT_ID);
    let thread = [
        cursor.clone(),
        person.clone(),
        rox_ai.clone(),
        rox_ai.clone(),
        cursor.clone(),
        rox_ai.clone(),
        cursor.clone(),
    ];
    assert_eq!(agent_hops(thread[..2].iter()), 0);
    assert_eq!(agent_hops(thread[..4].iter()), 1);
    assert_eq!(agent_hops(thread[..5].iter()), 2);
    assert_eq!(agent_hops(thread[..6].iter()), 3);
    assert_eq!(agent_hops(thread.iter()), 4);
    assert_eq!(agent_hops([cursor].iter()), 1);
}
