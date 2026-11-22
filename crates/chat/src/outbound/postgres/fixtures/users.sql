INSERT INTO public."Organization" ("id","name")
(SELECT 1, 'organization-one');

INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id")
(SELECT 'a1111111-1111-1111-1111-111111111111', 'test@example.com', 'test@example.com', 'stripe_test');

INSERT INTO public."User" ("id","email","stripeCustomerId","rox_user_id")
(SELECT 'rox|test@example.com', 'test@example.com','stripe_test','a1111111-1111-1111-1111-111111111111');

INSERT INTO public."Project" ("id", "name", "userId")
VALUES ('project-123', 'Test Project', 'rox|test@example.com');
