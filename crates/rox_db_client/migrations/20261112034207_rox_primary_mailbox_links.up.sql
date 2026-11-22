SET LOCAL lock_timeout = '5s';

ALTER TABLE rox_user
    ADD COLUMN mailbox_handle_claimed_at TIMESTAMPTZ;

-- Detach the consent guard for the whole rewrite and restore it below. The
-- backfill clears primaries before choosing the new one, and that intermediate
-- state must not read as a mailbox lifecycle change that revokes a grant.
DROP TRIGGER IF EXISTS email_links_revoke_crm_consent ON email_links;

-- Preserve the column and every dependent object. PostgreSQL 17 removes the
-- generated expression without dropping the column or its CRM trigger.
ALTER TABLE email_links
    ALTER COLUMN is_primary DROP EXPRESSION;

-- A BEFORE trigger distinguishes omitted values from old writers (NULL) from
-- explicit primary facts supplied by new writers. NOT NULL remains enforced.
ALTER TABLE email_links
    ALTER COLUMN is_primary SET DEFAULT NULL;

-- One primary row per rox_id. An omitted value still resolves to a fact, but
-- that fact now prefers the account's Rox mailbox: a Gmail address equal to the
-- login email keeps its row non-primary instead of competing with the Rox link.
-- Accounts without a Rox row keep the legacy generated value, so nothing is
-- lost. A row that becomes primary retires the previous primary of the same
-- rox_id, which is what makes the partial unique index below satisfiable.
CREATE FUNCTION email_links_preserve_legacy_primary() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_primary IS NULL THEN
        NEW.is_primary := NEW.provider = 'ROX'
            OR (NEW.rox_id = 'macro|' || lower(NEW.email_address::text)
                AND NOT EXISTS (
                    SELECT 1 FROM email_links AS rox
                    WHERE rox.rox_id = NEW.rox_id AND rox.provider = 'ROX'
                ));
    ELSIF TG_OP = 'UPDATE'
        AND NEW.is_primary IS NOT DISTINCT FROM OLD.is_primary
        AND (OLD.rox_id IS DISTINCT FROM NEW.rox_id
            OR OLD.email_address IS DISTINCT FROM NEW.email_address)
    THEN
        NEW.is_primary := NEW.rox_id = 'macro|' || lower(NEW.email_address::text)
            AND NOT EXISTS (
                SELECT 1 FROM email_links AS rox
                WHERE rox.rox_id = NEW.rox_id AND rox.provider = 'ROX'
            );
    END IF;
    IF NEW.is_primary THEN
        -- Retiring the previous primary is an ordinary is_primary update, so the
        -- demoted row keeps its own consent lifecycle.
        UPDATE email_links
        SET is_primary = false
        WHERE rox_id = NEW.rox_id AND id <> NEW.id AND is_primary;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER email_links_preserve_legacy_primary
BEFORE INSERT OR UPDATE OF rox_id, email_address, is_primary ON email_links
FOR EACH ROW EXECUTE FUNCTION email_links_preserve_legacy_primary();

-- Collapse the existing values onto exactly one primary row per rox_id.
-- Clearing first means the chosen row is never inserted next to an old primary.
-- ROX rows win; an account with no ROX row keeps the legacy row primary so its
-- current value survives the deployment. DISTINCT ON keeps the statement itself
-- within the invariant when an account holds several candidate rows.
UPDATE email_links SET is_primary = false WHERE is_primary;

WITH chosen AS (
    SELECT DISTINCT ON (link.rox_id) link.id
    FROM email_links AS link
    WHERE link.provider = 'ROX'
        OR (
            link.rox_id = 'macro|' || lower(link.email_address::text)
            AND NOT EXISTS (
                SELECT 1 FROM email_links AS rox
                WHERE rox.rox_id = link.rox_id AND rox.provider = 'ROX'
            )
        )
    ORDER BY link.rox_id, (link.provider = 'ROX') DESC, link.created_at, link.id
)
UPDATE email_links AS link
SET is_primary = true
FROM chosen
WHERE link.id = chosen.id;

-- The invariant belongs to the schema, not to every writer.
CREATE UNIQUE INDEX email_links_one_primary_per_rox_id
    ON email_links (rox_id)
    WHERE is_primary;

-- Recreate the consent guard atomically even on engines where changing the
-- generated expression drops dependent objects. Returning to primary or a
-- connected state must never resurrect an earlier grant.
DROP TRIGGER IF EXISTS email_links_revoke_crm_consent ON email_links;
CREATE TRIGGER email_links_revoke_crm_consent
AFTER UPDATE OF is_primary, deleting_at, disconnect_requested_at, needs_reauth,
    rox_id, email_address ON email_links
FOR EACH ROW WHEN (
    OLD.is_primary IS DISTINCT FROM NEW.is_primary
    OR OLD.deleting_at IS DISTINCT FROM NEW.deleting_at
    OR OLD.disconnect_requested_at IS DISTINCT FROM NEW.disconnect_requested_at
    OR (NOT OLD.needs_reauth AND NEW.needs_reauth)
    OR OLD.rox_id IS DISTINCT FROM NEW.rox_id
    OR OLD.email_address IS DISTINCT FROM NEW.email_address
)
EXECUTE FUNCTION crm_revoke_changed_mailbox_consent();
