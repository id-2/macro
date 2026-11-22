ALTER TABLE email_send_attempts RENAME COLUMN restore_body_rox TO restore_body_macro;

ALTER TABLE email_messages RENAME COLUMN body_rox TO body_macro;

CREATE OR REPLACE FUNCTION clear_terminal_email_send_content() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sent OR NEW.cancelled THEN
        NEW.request := email_send_attempt_identity(NEW.request);
        NEW.prepared_content := NULL;
        NEW.restore_body_html := NULL;
        NEW.restore_body_text := NULL;
        NEW.restore_body_macro := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION preserve_deleted_email_send_delivery() RETURNS TRIGGER AS $$
DECLARE
    scheduled email_scheduled_messages%ROWTYPE;
BEGIN
    IF NOT OLD.is_sent AND EXISTS (SELECT 1 FROM email_links
                                  WHERE id = OLD.link_id AND deleting_at IS NULL)
       AND EXISTS (SELECT 1 FROM email_send_attempts
                   WHERE message_id = OLD.id AND link_id = OLD.link_id
                     AND NOT cancelled AND NOT sent) THEN
        INSERT INTO email_deferred_message_deletions (message_id, provider_id, draft_generation)
        VALUES (OLD.id, OLD.provider_id, OLD.draft_generation)
        ON CONFLICT (message_id) DO UPDATE
            SET provider_id = EXCLUDED.provider_id, draft_generation = EXCLUDED.draft_generation;
        RETURN NULL;
    END IF;
    SELECT * INTO scheduled FROM email_scheduled_messages
    WHERE message_id = OLD.id AND link_id = OLD.link_id FOR UPDATE;

    IF OLD.is_sent OR COALESCE(scheduled.sent, FALSE) THEN
        UPDATE email_send_attempts SET sent = TRUE
        WHERE message_id = OLD.id AND link_id = OLD.link_id
          AND NOT cancelled AND NOT sent;
    ELSIF scheduled.delivery_status <> 'failed' AND (
        scheduled.delivery_started_at IS NOT NULL
        OR scheduled.delivery_status = 'unconfirmed'
        OR (scheduled.processing AND scheduled.delivery_claim_id IS NULL)
    ) THEN
        UPDATE email_send_attempts SET delivery_unconfirmed = TRUE
        WHERE message_id = OLD.id AND link_id = OLD.link_id
          AND NOT cancelled AND NOT sent;
    END IF;
    UPDATE email_send_attempts
    SET request = email_send_attempt_identity(request), prepared_content = NULL,
        restore_body_html = NULL, restore_body_text = NULL, restore_body_macro = NULL
    WHERE message_id = OLD.id AND link_id = OLD.link_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
