-- no-transaction
-- Multi-inbox requires multiple email_links per rox_id (each row is a separate
-- inbox the user has linked). The unique index from migration 20260220183100
-- encoded the old "one inbox per user" assumption and now blocks the second
-- INSERT in email_db_client::links::insert::upsert_link.
DROP INDEX CONCURRENTLY IF EXISTS email_links_rox_id_uq;
