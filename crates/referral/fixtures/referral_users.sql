-- Referrer: rox_user + User
INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'referrer', 'referrer@test.com', 'cus_referrer');

INSERT INTO "User" (id, email, rox_user_id) VALUES
    ('macro|referrer@test.com', 'referrer@test.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

-- Referred: rox_user + User
INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'referred', 'referred@test.com', 'cus_referred');

INSERT INTO "User" (id, email, rox_user_id) VALUES
    ('macro|referred@test.com', 'referred@test.com', 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid);
