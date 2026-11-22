-- Directed link between two rox_ids: primary holds an inbox-delegation over child.
-- Multi-inbox is currently the only consumer; the semantic ("primary can read child's
-- email_links") is implicit. If we ever need other capabilities we'll add a column then.
CREATE TABLE IF NOT EXISTS rox_user_links (
    primary_rox_id TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    child_rox_id   TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (primary_rox_id, child_rox_id),
    CHECK (primary_rox_id <> child_rox_id)
);

-- Reverse lookup: "which primaries delegate from this child?"
CREATE INDEX IF NOT EXISTS rox_user_links_child_idx
    ON rox_user_links (child_rox_id);
