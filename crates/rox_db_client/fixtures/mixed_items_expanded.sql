-- Disable foreign key constraints temporarily for easier setup
SET session_replication_role = 'replica';

---------------------------------
--  BASE SETUP: USER & ORG
---------------------------------

-- Create Organization (needed for User foreign key)
INSERT INTO public."Organization" ("id", "name", "status")
VALUES (1, 'Test Organization', 'PILOT')
ON CONFLICT DO NOTHING;

INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id")
VALUES ('a1111111-1111-1111-1111-111111111111', 'user@test.com', 'user@test.com', 'stripe_id_1');

-- Insert user
INSERT INTO public."User" ("id", "email", "stripeCustomerId", "organizationId", "rox_user_id")
VALUES ('rox|user-1@test.com', 'user@test.com', 'stripe_id_1', 1, 'a1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

---------------------------------
--  PROJECT HIERARCHY SETUP
--  A -> B -> C
---------------------------------

-- SCENARIO: Top-level project A. User will get 'view' access to this.
INSERT INTO public."Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt")
VALUES ('aaaaaaaa-ffff-ffff-ffff-ffffffffffff', 'Project A (User has VIEW)', 'rox|user-1@test.com', NULL, '2023-01-01 10:00:00', '2023-01-01 10:00:00');

-- SCENARIO: Nested project B, inside A.
INSERT INTO public."Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt")
VALUES ('bbbbbbbb-ffff-ffff-ffff-ffffffffffff', 'Project B (Child of A)', 'rox|user-1@test.com', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff', '2023-01-01 11:00:00', '2023-01-01 11:00:00');

-- SCENARIO: Deeply nested project C, inside B.
INSERT INTO public."Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt")
VALUES ('cccccccc-ffff-ffff-ffff-ffffffffffff', 'Project C (Child of B)', 'rox|user-1@test.com', 'bbbbbbbb-ffff-ffff-ffff-ffffffffffff', '2023-01-01 12:00:00', '2023-01-01 12:00:00');

-- SCENARIO: Another top-level project D. User will get 'owner' access to this project
-- but only 'comment' access to the document inside, to test which permission wins.
INSERT INTO public."Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt")
VALUES ('dddddddd-ffff-ffff-ffff-ffffffffffff', 'Project D (User has OWNER)', 'rox|user-1@test.com', NULL, '2023-01-02 10:00:00', '2023-01-02 10:00:00');

-- SCENARIO: An isolated project the user should NOT have access to.
INSERT INTO public."Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt")
VALUES ('99999999-ffff-ffff-ffff-ffffffffffff', 'Isolated Project', 'rox|user-1@test.com', NULL, '2023-01-03 10:00:00', '2023-01-03 10:00:00');


---------------------------------------------------
--  DOCUMENTS, CHATS, AND THEIR DEPENDENCIES
---------------------------------------------------

-- Document Families (one for each document)
INSERT INTO public."DocumentFamily" ("id", "rootDocumentId")
VALUES (1, '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
       (2, '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
       (3, '11111111-cccc-cccc-cccc-cccccccccccc'),
       (4, '11111111-dddd-dddd-dddd-dddddddddddd'),
       (5, '11111111-0000-0000-0000-000000000000'),
       (6, '11111111-9999-9999-9999-999999999999');

-- Documents
INSERT INTO public."Document" ("id", "name", "owner", "projectId", "documentFamilyId", "fileType", "createdAt",
                               "updatedAt")
VALUES ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Document in A', 'rox|user-1@test.com', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff', 1, 'pdf', '2023-01-05 10:00:00', '2023-01-05 10:00:00'),
       ('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Document in B', 'rox|user-1@test.com', 'bbbbbbbb-ffff-ffff-ffff-ffffffffffff', 2, 'pdf', '2023-01-05 11:00:00', '2023-01-05 11:00:00'),
       ('11111111-cccc-cccc-cccc-cccccccccccc', 'Document in C', 'rox|user-1@test.com', 'cccccccc-ffff-ffff-ffff-ffffffffffff', 3, 'pdf', '2023-01-05 12:00:00', '2023-01-05 12:00:00'),
       ('11111111-dddd-dddd-dddd-dddddddddddd', 'Document in D', 'rox|user-1@test.com', 'dddddddd-ffff-ffff-ffff-ffffffffffff', 4, 'pdf', '2023-01-05 13:00:00', '2023-01-05 13:00:00'),
       ('11111111-0000-0000-0000-000000000000', 'Standalone Document', 'rox|user-1@test.com', NULL, 5, 'pdf', '2023-01-05 14:00:00',
        '2023-01-05 14:00:00'),
       ('11111111-9999-9999-9999-999999999999', 'Isolated Document', 'rox|user-1@test.com', '99999999-ffff-ffff-ffff-ffffffffffff', 6, 'pdf', '2023-01-05 15:00:00',
        '2023-01-05 15:00:00');

-- Document Instances (one for each document)
INSERT INTO public."DocumentInstance" ("id", "documentId", "sha", "createdAt", "updatedAt")
VALUES (1, '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sha_A', '2023-01-05 10:00:00', '2023-01-05 10:00:00'),
       (2, '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sha_B', '2023-01-05 11:00:00', '2023-01-05 11:00:00'),
       (3, '11111111-cccc-cccc-cccc-cccccccccccc', 'sha_C', '2023-01-05 12:00:00', '2023-01-05 12:00:00'),
       (4, '11111111-dddd-dddd-dddd-dddddddddddd', 'sha_D', '2023-01-05 13:00:00', '2023-01-05 13:00:00'),
       (5, '11111111-0000-0000-0000-000000000000', 'sha_standalone', '2023-01-05 14:00:00', '2023-01-05 14:00:00'),
       (6, '11111111-9999-9999-9999-999999999999', 'sha_isolated', '2023-01-05 15:00:00', '2023-01-05 15:00:00');

-- Chats
INSERT INTO public."Chat" ("id", "name", "userId", "projectId", "createdAt", "updatedAt")
VALUES ('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chat in A', 'rox|user-1@test.com', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff', '2023-01-06 10:00:00', '2023-01-06 10:00:00'),
       ('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Chat in B', 'rox|user-1@test.com', 'bbbbbbbb-ffff-ffff-ffff-ffffffffffff', '2023-01-06 11:00:00', '2023-01-06 11:00:00'),
       ('22222222-cccc-cccc-cccc-cccccccccccc', 'Chat in C', 'rox|user-1@test.com', 'cccccccc-ffff-ffff-ffff-ffffffffffff', '2023-01-06 12:00:00', '2023-01-06 12:00:00'),
       ('22222222-0000-0000-0000-000000000000', 'Standalone Chat', 'rox|user-1@test.com', NULL, '2023-01-06 13:00:00', '2023-01-06 13:00:00'),
       ('22222222-9999-9999-9999-999999999999', 'Isolated Chat', 'rox|user-1@test.com', '99999999-ffff-ffff-ffff-ffffffffffff', '2023-01-06 14:00:00', '2023-01-06 14:00:00');

---------------------------------------------------
--  USER ACCESS PERMISSIONS (entity_access)
---------------------------------------------------
-- entity_access denormalizes all access including project-inherited items.
-- So we add rows for every item the user can access.

INSERT INTO public.entity_access ("entity_id", "entity_type", "source_id", "source_type", "access_level", "granted_from_project_id")
VALUES
-- Direct access to project-A (view)
('aaaaaaaa-ffff-ffff-ffff-ffffffffffff', 'project', 'rox|user-1@test.com', 'user', 'view', NULL),

-- Inherited access to project-B and project-C from project-A
('bbbbbbbb-ffff-ffff-ffff-ffffffffffff', 'project', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('cccccccc-ffff-ffff-ffff-ffffffffffff', 'project', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),

-- Inherited access to items in project-A hierarchy
('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'document', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chat', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'document', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'chat', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('11111111-cccc-cccc-cccc-cccccccccccc', 'document', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),
('22222222-cccc-cccc-cccc-cccccccccccc', 'chat', 'rox|user-1@test.com', 'user', 'view', 'aaaaaaaa-ffff-ffff-ffff-ffffffffffff'),

-- Direct 'edit' on doc-in-B (higher than inherited 'view')
('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'document', 'rox|user-1@test.com', 'user', 'edit', NULL),

-- Direct access to project-D (owner) and its document
('dddddddd-ffff-ffff-ffff-ffffffffffff', 'project', 'rox|user-1@test.com', 'user', 'owner', NULL),
('11111111-dddd-dddd-dddd-dddddddddddd', 'document', 'rox|user-1@test.com', 'user', 'owner', 'dddddddd-ffff-ffff-ffff-ffffffffffff'),
('11111111-dddd-dddd-dddd-dddddddddddd', 'document', 'rox|user-1@test.com', 'user', 'comment', NULL),

-- Direct access to standalone items
('11111111-0000-0000-0000-000000000000', 'document', 'rox|user-1@test.com', 'user', 'owner', NULL),
('22222222-0000-0000-0000-000000000000', 'chat', 'rox|user-1@test.com', 'user', 'owner', NULL);

-- NOTE: There are no access records for 'project-isolated', 'doc-isolated', or 'chat-isolated'.
-- These items should NOT be returned by the query for 'rox|user-1@test.com'.

INSERT INTO public."UserHistory" ("userId", "itemId", "itemType", "createdAt", "updatedAt")
VALUES ('rox|user-1@test.com', '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'document', '2024-01-01 00:00:00', '2024-01-10 10:00:00'), -- Most recent
       ('rox|user-1@test.com', '22222222-0000-0000-0000-000000000000', 'chat', '2024-01-01 00:00:00', '2024-01-09 10:00:00'),
       ('rox|user-1@test.com', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'document', '2024-01-01 00:00:00', '2024-01-08 10:00:00'),
       ('rox|user-1@test.com', '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chat', '2024-01-01 00:00:00', '2024-01-07 10:00:00'),
       ('rox|user-1@test.com', '11111111-0000-0000-0000-000000000000', 'document', '2024-01-01 00:00:00', '2024-01-06 14:00:00'),
       ('rox|user-1@test.com', '11111111-dddd-dddd-dddd-dddddddddddd', 'document', '2024-01-01 00:00:00',
        '2023-01-05 13:30:00'),                                                          -- History time is newer than item time
       ('rox|user-1@test.com', '22222222-cccc-cccc-cccc-cccccccccccc', 'chat', '2024-01-01 00:00:00', '2023-01-04 10:00:00');

-- Re-enable foreign key constraints
SET session_replication_role = 'origin';
