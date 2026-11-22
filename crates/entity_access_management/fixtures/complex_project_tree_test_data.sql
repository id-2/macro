INSERT INTO public."Organization" ("id", "name")
    VALUES (1, 'test-org');

-- Three users (UA, UB, UC)
INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id") VALUES
    ('a1111111-1111-1111-1111-111111111111', 'user_a', 'user_a@test.com', 'stripe_a'),
    ('a2222222-2222-2222-2222-222222222222', 'user_b', 'user_b@test.com', 'stripe_b'),
    ('a3333333-3333-3333-3333-333333333333', 'user_c', 'user_c@test.com', 'stripe_c');

INSERT INTO public."User" ("id", "email", "stripeCustomerId", "organizationId", "rox_user_id") VALUES
    ('rox|user_a@test.com', 'user_a@test.com', 'stripe_a', 1, 'a1111111-1111-1111-1111-111111111111'),
    ('rox|user_b@test.com', 'user_b@test.com', 'stripe_b', 1, 'a2222222-2222-2222-2222-222222222222'),
    ('rox|user_c@test.com', 'user_c@test.com', 'stripe_c', 1, 'a3333333-3333-3333-3333-333333333333');

-- PROJECT_A (root, owner UA)
INSERT INTO public."Project" ("id", "name", "userId")
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'project-a', 'rox|user_a@test.com');

-- PROJECT_B (child of A, owner UB)
INSERT INTO public."Project" ("id", "name", "userId", "parentId")
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'project-b', 'rox|user_b@test.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- PROJECT_C (child of B, owner UC)
INSERT INTO public."Project" ("id", "name", "userId", "parentId")
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project-c', 'rox|user_c@test.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Documents: one in project_a, one in project_c
INSERT INTO public."Document" ("id", "name", "owner", "projectId")
    VALUES ('doc-in-a', 'doc-a', 'rox|user_a@test.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public."Document" ("id", "name", "owner", "projectId")
    VALUES ('doc-in-c', 'doc-c', 'rox|user_c@test.com', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Chats: one in project_b
INSERT INTO public."Chat" ("id", "name", "userId", "projectId")
    VALUES ('chat-in-b', 'chat-b', 'rox|user_b@test.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Direct owner records (granted_from_project_id IS NULL)
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'project', 'rox|user_a@test.com', 'user', 'owner');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'project', 'rox|user_b@test.com', 'user', 'owner');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'rox|user_c@test.com', 'user', 'owner');

-- Inherited owner records (should be excluded by query)
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'project', 'rox|user_a@test.com', 'user', 'owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'rox|user_a@test.com', 'user', 'owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'rox|user_b@test.com', 'user', 'owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Direct channel/team shares (granted_from_project_id IS NULL)
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'project', 'channel-1', 'channel', 'view');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'project', 'team-1', 'team', 'edit');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'channel-2', 'channel', 'comment');

-- Inherited channel/team shares (should be excluded by query)
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'project', 'channel-1', 'channel', 'view', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'channel-1', 'channel', 'view', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level, granted_from_project_id)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'project', 'team-1', 'team', 'edit', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
