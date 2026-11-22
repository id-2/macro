INSERT INTO user_notification_item_unsubscribe (user_id, item_id, item_type, snoozed_until)
VALUES
    ('rox|alice@example.com', 'document-snoozed', 'document', NOW() + INTERVAL '1 hour'),
    ('rox|alice@example.com', 'channel-muted', 'channel', NULL),
    ('rox|alice@example.com', 'email-alias', 'email', NULL),
    ('rox|alice@example.com', 'thread-alias', 'thread', NULL),
    ('rox|alice@example.com', 'foreign-alias', 'foreign', NULL),
    ('rox|alice@example.com', 'unknown-note', 'note', NULL),
    ('rox|alice@example.com', 'unknown-task', 'task', NULL),
    ('rox|alice@example.com', 'unknown-dm', 'dm', NULL),
    ('rox|alice@example.com', 'unknown-thread', 'channel_thread', NULL),
    ('rox|alice@example.com', 'expired', 'document', NOW() - INTERVAL '1 hour'),
    ('rox|bob@example.com', 'other-user', 'document', NULL);
