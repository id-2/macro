INSERT INTO rox_user (id, username, email, stripe_customer_id)
VALUES
    ('a0000000-0000-0000-0000-000000000000', 'member', 'member@test.com', 'cus_member'),
    ('a0000000-0000-0000-0000-000000000001', 'gabriel', 'gabriel@test.com', 'cus_gabriel'),
    ('a0000000-0000-0000-0000-000000000002', 'peter', 'peter@test.com', 'cus_peter'),
    ('a0000000-0000-0000-0000-000000000003', 'teo', 'teo@test.com', 'cus_teo'),
    ('a0000000-0000-0000-0000-000000000004', 'hollis', 'hollis@test.com', 'cus_hollis');

INSERT INTO "User" (id, email, rox_user_id)
VALUES
    ('rox|member@test.com', 'member@test.com', 'a0000000-0000-0000-0000-000000000000'),
    ('rox|gabriel@test.com', 'gabriel@test.com', 'a0000000-0000-0000-0000-000000000001'),
    ('rox|peter@test.com', 'peter@test.com', 'a0000000-0000-0000-0000-000000000002'),
    ('rox|teo@test.com', 'teo@test.com', 'a0000000-0000-0000-0000-000000000003'),
    ('rox|hollis@test.com', 'hollis@test.com', 'a0000000-0000-0000-0000-000000000004');

-- The member has no profile and nameless@test.com has no user row at all:
-- both fall back to the local part of their email.
INSERT INTO rox_user_info (rox_user_id, first_name, last_name)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Gabriel', 'Birman'),
    ('a0000000-0000-0000-0000-000000000002', 'Peter', 'Chinman'),
    ('a0000000-0000-0000-0000-000000000003', 'Teo', 'Nys'),
    ('a0000000-0000-0000-0000-000000000004', 'Hollis', 'N/A');

INSERT INTO bots (id, kind, owner_user_id, name, handle, created_by)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'owned', 'rox|member@test.com', 'Deal Desk', 'deal-desk', 'rox|member@test.com');

INSERT INTO comms_channels (id, name, channel_type, owner_id, created_at, updated_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Rox', 'private', 'rox|member@test.com', '2024-01-01 10:00:00+00', '2024-12-01 10:00:00+00'),
    ('22222222-2222-2222-2222-222222222222', 'Rox Planning', 'private', 'rox|member@test.com', '2024-01-02 10:00:00+00', '2024-12-02 10:00:00+00'),
    ('33333333-3333-3333-3333-333333333333', 'Macaroni', 'private', 'rox|member@test.com', '2024-01-03 10:00:00+00', '2024-12-03 10:00:00+00'),
    ('44444444-4444-4444-4444-444444444444', 'Rox Secret', 'private', 'rox|other@test.com', '2024-01-04 10:00:00+00', '2024-12-04 10:00:00+00'),
    ('55555555-5555-5555-5555-555555555555', 'Rox Former', 'private', 'rox|former@test.com', '2024-01-05 10:00:00+00', '2024-12-05 10:00:00+00'),
    ('66666666-6666-6666-6666-666666666666', NULL, 'direct_message', 'rox|member@test.com', '2024-01-06 10:00:00+00', '2024-12-06 10:00:00+00'),
    ('77777777-7777-7777-7777-777777777777', NULL, 'private', 'rox|member@test.com', '2024-01-07 10:00:00+00', '2024-12-07 10:00:00+00'),
    ('88888888-8888-8888-8888-888888888888', NULL, 'direct_message', 'rox|member@test.com', '2024-01-08 10:00:00+00', '2024-12-08 10:00:00+00'),
    ('99999999-9999-9999-9999-999999999999', NULL, 'direct_message', 'rox|member@test.com', '2024-01-09 10:00:00+00', '2024-12-09 10:00:00+00'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'direct_message', 'rox|member@test.com', '2024-01-10 10:00:00+00', '2024-12-10 10:00:00+00'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Design Decks', 'public', 'rox|member@test.com', '2024-01-11 10:00:00+00', '2024-12-11 10:00:00+00'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'direct_message', 'rox|member@test.com', '2024-01-12 10:00:00+00', '2024-12-12 10:00:00+00'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', NULL, 'direct_message', 'rox|member@test.com', '2024-01-13 10:00:00+00', '2024-12-13 10:00:00+00');

INSERT INTO comms_channel_participants (channel_id, role, user_id, left_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner', 'rox|member@test.com', NULL),
    ('22222222-2222-2222-2222-222222222222', 'owner', 'rox|member@test.com', NULL),
    ('33333333-3333-3333-3333-333333333333', 'owner', 'rox|member@test.com', NULL),
    ('44444444-4444-4444-4444-444444444444', 'owner', 'rox|other@test.com', NULL),
    ('55555555-5555-5555-5555-555555555555', 'owner', 'rox|former@test.com', '2024-06-01 10:00:00+00'),
    ('66666666-6666-6666-6666-666666666666', 'owner', 'rox|member@test.com', NULL),
    ('66666666-6666-6666-6666-666666666666', 'member', 'rox|gabriel@test.com', NULL),
    ('77777777-7777-7777-7777-777777777777', 'owner', 'rox|member@test.com', NULL),
    ('77777777-7777-7777-7777-777777777777', 'member', 'rox|peter@test.com', NULL),
    ('77777777-7777-7777-7777-777777777777', 'member', 'rox|teo@test.com', NULL),
    ('88888888-8888-8888-8888-888888888888', 'owner', 'rox|member@test.com', NULL),
    ('88888888-8888-8888-8888-888888888888', 'member', 'rox|nameless@test.com', NULL),
    ('99999999-9999-9999-9999-999999999999', 'owner', 'rox|member@test.com', NULL),
    ('99999999-9999-9999-9999-999999999999', 'member', 'bot|00000000-0000-0000-0000-00000000c0de', NULL),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'rox|member@test.com', NULL),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member', 'bot|b0000000-0000-0000-0000-000000000001', NULL),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', 'rox|member@test.com', NULL),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner', 'rox|member@test.com', NULL),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'member', 'rox|hollis@test.com', NULL),
    -- A bot with no `bots` row (deleted or unknown) shows as "Bot".
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'owner', 'rox|member@test.com', NULL),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'member', 'bot|b0000000-0000-0000-0000-000000000002', NULL);
