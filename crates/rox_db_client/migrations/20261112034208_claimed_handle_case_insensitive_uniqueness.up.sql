-- no-transaction
CREATE UNIQUE INDEX CONCURRENTLY rox_user_claimed_handle_lower_key
    ON rox_user (lower(username))
    WHERE mailbox_handle_claimed_at IS NOT NULL;
