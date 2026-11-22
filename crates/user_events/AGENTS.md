# user_events

## What it is

Kafka event models for the `macro.users` topic: changes to a user's own
profile that other people see, such as a new profile picture.

## Scope

- Owns: `UserTopicEvent` and its metadata, keyed by user id.
- Not here: publishing (the authentication service), fan-out to contacts →
  `crates/contacts`, webhook delivery → `crates/webhook`.

## Boundaries

- Depends on: `rox_event_broker`, `rox_event_topics`, `rox_user_id`.
- Used by: `authentication_service`, `contacts`, `webhook`.

## Checks

- `cargo test -p user_events --all-features`

## Gotchas

- `event_type` names are public webhook event names; renaming one breaks
  SDK and webhook consumers.
