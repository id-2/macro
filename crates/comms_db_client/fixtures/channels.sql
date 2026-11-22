INSERT INTO comms_channels (id, name, channel_type, org_id, owner_id)
VALUES ('11111111-1111-1111-1111-111111111111', 'private 1 ', 'private', NULL, 'rox|user1@test.com'),
       ('22222222-2222-2222-2222-222222222222', NULL, 'direct_message', NULL, 'rox|user3@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'public channel', 'public', NULL, 'rox|user5@test.com');

INSERT INTO comms_channel_participants (channel_id, role, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', 'owner', 'rox|user1@test.com'),
       ('11111111-1111-1111-1111-111111111111', 'member', 'rox|user2@test.com'),
       ('11111111-1111-1111-1111-111111111111', 'member', 'rox|user3@test.com'),
       ('22222222-2222-2222-2222-222222222222', 'owner', 'rox|user3@test.com'),
       ('22222222-2222-2222-2222-222222222222', 'member', 'rox|user4@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'owner', 'rox|user5@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'member', 'rox|user1@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'member', 'rox|user2@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'member', 'rox|user3@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'member', 'rox|user4@test.com'),
       ('33333333-3333-3333-3333-333333333333', 'member', 'rox|user7@test.com');
-- User7 will later have left_at set to simulate leaving the channel
-- This is handled in integration test or a migration if requested again.

