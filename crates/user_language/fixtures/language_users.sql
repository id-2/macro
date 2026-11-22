INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'language', 'language@test.com', 'cus_language');

INSERT INTO "User" (id, email, rox_user_id) VALUES
    ('rox|language@test.com', 'language@test.com', 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid);
