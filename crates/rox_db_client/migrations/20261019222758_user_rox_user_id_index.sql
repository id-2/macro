-- no-transaction
-- Keep this a single statement: SQLx batches would create an implicit transaction.
CREATE INDEX CONCURRENTLY "User_rox_user_id_idx" ON "User" (rox_user_id);
