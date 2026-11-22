-- no-transaction
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS email_links_rox_id_uq
ON email_links (rox_id);
