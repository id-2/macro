INSERT INTO rox_user (id, email, stripe_customer_id, username)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@rox.one', 'cus_123', 'u1'),
       ('22222222-2222-2222-2222-222222222222', 'test2@rox.one', 'cus_124', 'u2');

INSERT INTO rox_user_email_verification (rox_user_id, email, is_verified)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@rox.one', true),
       ('22222222-2222-2222-2222-222222222222', 'test2@rox.one', true);


INSERT INTO "User" ("id", "email", "rox_user_id")
VALUES ('rox|test@rox.one', 'test@rox.one', '11111111-1111-1111-1111-111111111111'),
       ('rox|test2@rox.one', 'test2@rox.one', '22222222-2222-2222-2222-222222222222');
