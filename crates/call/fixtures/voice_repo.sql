-- Fixture for pg_voice_repo integration tests.
--
-- Seeds two rox_user rows that tests link/unlink voices against.

INSERT INTO "rox_user" ("id", "username", "email", "stripe_customer_id") VALUES
  ('11111111-1111-1111-1111-111111111111', 'voice-user-a', 'voice-a@test.com', 'cus_voice_a'),
  ('22222222-2222-2222-2222-222222222222', 'voice-user-b', 'voice-b@test.com', 'cus_voice_b');
