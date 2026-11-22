-- A calendar Rox keeps itself: a signed-in user with no Google or Outlook
-- link gets a personal calendar in Postgres, and events on it are written
-- and read locally with no external calendar call.

ALTER TABLE calendar_accounts
    DROP CONSTRAINT IF EXISTS calendar_accounts_provider_check;
ALTER TABLE calendar_accounts
    ADD CONSTRAINT calendar_accounts_provider_check
        CHECK (provider IN ('google', 'outlook', 'rox')) NOT VALID;
ALTER TABLE calendar_accounts
    VALIDATE CONSTRAINT calendar_accounts_provider_check;

ALTER TABLE calendar_event_sources
    DROP CONSTRAINT IF EXISTS calendar_event_sources_source_kind_check;
ALTER TABLE calendar_event_sources
    ADD CONSTRAINT calendar_event_sources_source_kind_check
        CHECK (source_kind IN ('google', 'outlook', 'local')) NOT VALID;
ALTER TABLE calendar_event_sources
    VALIDATE CONSTRAINT calendar_event_sources_source_kind_check;

ALTER TABLE calendar_events
    DROP CONSTRAINT IF EXISTS calendar_events_canonical_source_kind_check;
ALTER TABLE calendar_events
    ADD CONSTRAINT calendar_events_canonical_source_kind_check
        CHECK (canonical_source_kind IN ('google', 'outlook', 'local')) NOT VALID;
ALTER TABLE calendar_events
    VALIDATE CONSTRAINT calendar_events_canonical_source_kind_check;
