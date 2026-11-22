INSERT INTO "Organization" (id, name) VALUES (1, 'test organization');

INSERT INTO "rox_user" (id, username, email, stripe_customer_id)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'user@user.com', 'user@user.com', 'stripe_id'),
    ('a2222222-2222-2222-2222-222222222222', 'user2@user.com', 'user2@user.com', 'stripe_id2'),
    ('a3333333-3333-3333-3333-333333333333', 'user3@user.com', 'user3@user.com', 'stripe_id3');

INSERT INTO public."User" ("id","email","stripeCustomerId", "organizationId", "rox_user_id")
(SELECT 'rox|user@user.com', 'user@user.com','stripe_id', 1, 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public."User" ("id","email","stripeCustomerId", "organizationId", "rox_user_id")
(SELECT 'rox|user2@user.com', 'user2@user.com','stripe_id2', 1, 'a2222222-2222-2222-2222-222222222222');
INSERT INTO public."User" ("id","email","stripeCustomerId", "rox_user_id")
(SELECT 'rox|user3@user.com', 'user3@user.com','stripe_id3', 'a3333333-3333-3333-3333-333333333333');

INSERT INTO public."Document" ("id","name","fileType", "owner")
(SELECT 'd1', 'test_document_name','pdf', 'rox|user@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'd1', 'document', NOW() - INTERVAL '5 days');

INSERT INTO public."Document" ("id","name","fileType", "owner")
(SELECT 'd1a', 'test_document_name','pdf', 'rox|user@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'd1a', 'document', NOW() - INTERVAL '1 days');

INSERT INTO public."Document" ("id","name","fileType", "owner")
(SELECT 'd2', 'test_document_name','docx', 'rox|user2@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'd2', 'document', NOW() - INTERVAL '2 days');

INSERT INTO public."Document" ("id","name","fileType", "owner")
(SELECT 'd3', 'test_document_name','md', 'rox|user3@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'd3', 'document', NOW() - INTERVAL '33 days');

INSERT INTO public."Chat" ("id","name","userId")
(SELECT 'c1', 'test_chat_name', 'rox|user@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'c1', 'chat', NOW() - INTERVAL '5 days');

INSERT INTO public."Chat" ("id","name","userId")
(SELECT 'c1a', 'test_chat_name', 'rox|user@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'c1a', 'chat', NOW() - INTERVAL '1 days');

INSERT INTO public."Chat" ("id","name","userId")
(SELECT 'c2', 'test_chat_name', 'rox|user2@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'c2', 'chat', NOW() - INTERVAL '2 days');

INSERT INTO public."Chat" ("id","name","userId")
(SELECT 'c3', 'test_chat_name', 'rox|user3@user.com');
INSERT INTO public."ItemLastAccessed" ("item_id", "item_type", "last_accessed")
(SELECT 'c3', 'chat', NOW() - INTERVAL '33 days');
