use std::collections::HashSet;

use super::*;

#[test]
fn all_topic_names_is_non_empty_and_unique() {
    let names = all_topic_names();
    assert!(!names.is_empty());

    let unique: HashSet<_> = names.iter().collect();
    assert_eq!(
        unique.len(),
        names.len(),
        "duplicate topic names: {names:?}"
    );
}

#[test]
fn all_topic_names_includes_declared_topics() {
    assert!(all_topic_names().contains(&RoxExampleTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxDocumentsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxSoupRealtimeTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxProjectsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxInitiativesTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxPropertiesTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxTeamsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxChannelsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxMessagesTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxBotsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxCallsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxCallNotificationsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxWebhooksTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxMentionsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxNotificationsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxChatsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxAgentSessionsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxAgentSessionLifecycleTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxDatabasesTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxFormsTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxUsersTopic::TOPIC_STR));
    assert!(all_topic_names().contains(&RoxPasswordsTopic::TOPIC_STR));
}
