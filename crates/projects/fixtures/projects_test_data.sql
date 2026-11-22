INSERT INTO public."rox_user" (id, username, email, stripe_customer_id)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'owner@test.com', 'owner@test.com', 'stripe-owner'),
    ('a2222222-2222-2222-2222-222222222222', 'viewer@test.com', 'viewer@test.com', 'stripe-viewer');

INSERT INTO public."User" (id, email, "stripeCustomerId", rox_user_id)
VALUES
    ('rox|owner@test.com', 'owner@test.com', 'stripe-owner', 'a1111111-1111-1111-1111-111111111111'),
    ('rox|viewer@test.com', 'viewer@test.com', 'stripe-viewer', 'a2222222-2222-2222-2222-222222222222');

INSERT INTO public."Project"
    (id, name, "userId", "parentId", "createdAt", "updatedAt", "deletedAt", "uploadPending", "uploadRequestId")
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Root', 'rox|owner@test.com', NULL, '2024-01-01', '2024-01-05', NULL, false, NULL),
    ('10000000-0000-0000-0000-000000000002', 'First child', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-02', '2024-01-02', NULL, false, NULL),
    ('10000000-0000-0000-0000-000000000003', 'Grandchild', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000002', '2024-01-03', '2024-01-03', NULL, false, NULL),
    ('10000000-0000-0000-0000-000000000004', 'Deleted child', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-04', '2024-01-04', '2024-02-01', false, NULL),
    ('10000000-0000-0000-0000-000000000005', 'Shared history', 'rox|owner@test.com', NULL, '2024-01-05', '2024-01-06', NULL, false, NULL),
    ('10000000-0000-0000-0000-000000000006', 'Owner pending', 'rox|owner@test.com', NULL, '2024-01-06', '2024-01-07', NULL, true, 'request-owner'),
    ('10000000-0000-0000-0000-000000000007', 'Viewer pending', 'rox|viewer@test.com', NULL, '2024-01-07', '2024-01-08', NULL, true, 'request-viewer'),
    ('10000000-0000-0000-0000-000000000008', 'Nested pending', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000006', '2024-01-08', '2024-01-09', NULL, true, 'request-owner'),
    ('10000000-0000-0000-0000-000000000009', 'Deleted root', 'rox|owner@test.com', NULL, '2024-01-09', '2024-01-10', '2024-02-02', false, NULL);

INSERT INTO public."UserHistory" ("userId", "itemId", "itemType")
VALUES
    ('rox|viewer@test.com', '10000000-0000-0000-0000-000000000001', 'project'),
    ('rox|viewer@test.com', '10000000-0000-0000-0000-000000000005', 'project'),
    ('rox|viewer@test.com', '10000000-0000-0000-0000-000000000006', 'project'),
    ('rox|viewer@test.com', '10000000-0000-0000-0000-000000000009', 'project');

INSERT INTO public."SharePermission" (id, "linkShare", "linkShareAccessLevel")
VALUES ('share-root', 'PUBLIC', 'edit');
INSERT INTO public."ProjectPermission" ("projectId", "sharePermissionId")
VALUES ('10000000-0000-0000-0000-000000000001', 'share-root');
INSERT INTO public."ChannelSharePermission" (share_permission_id, channel_id, access_level)
VALUES ('share-root', 'channel-one', 'view');

INSERT INTO public."Document" (id, name, "fileType", owner, "projectId", "createdAt", "updatedAt", "deletedAt")
VALUES
    ('20000000-0000-0000-0000-000000000001', 'Document', 'pdf', 'rox|viewer@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-03', '2024-01-03', NULL),
    ('20000000-0000-0000-0000-000000000002', 'Deleted document', 'pdf', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-04', '2024-01-04', '2024-02-01');
INSERT INTO public."DocumentInstance" ("documentId", "revisionName", sha, "createdAt", "updatedAt")
VALUES
    ('20000000-0000-0000-0000-000000000001', 'Document', 'sha-one', '2024-01-03', '2024-01-03'),
    ('20000000-0000-0000-0000-000000000002', 'Deleted document', 'sha-two', '2024-01-04', '2024-01-04');

INSERT INTO public."Chat" (id, name, "userId", "projectId", "createdAt", "updatedAt", "deletedAt")
VALUES
    ('30000000-0000-0000-0000-000000000001', 'Chat', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-04', '2024-01-04', NULL),
    ('30000000-0000-0000-0000-000000000002', 'Deleted chat', 'rox|owner@test.com', '10000000-0000-0000-0000-000000000001', '2024-01-05', '2024-01-05', '2024-02-01');

INSERT INTO public.entity_access (entity_id, entity_type, source_id, source_type, access_level)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000001', 'project', 'rox|viewer@test.com', 'user', 'view'),
    ('10000000-0000-0000-0000-000000000002', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000003', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000005', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000006', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000007', 'project', 'rox|viewer@test.com', 'user', 'owner'),
    ('10000000-0000-0000-0000-000000000008', 'project', 'rox|owner@test.com', 'user', 'owner'),
    ('20000000-0000-0000-0000-000000000001', 'document', 'rox|viewer@test.com', 'user', 'owner'),
    ('30000000-0000-0000-0000-000000000001', 'chat', 'rox|owner@test.com', 'user', 'owner');

INSERT INTO public.entity (id, entity_type, owner_type, owner_id, created_at, updated_at, deleted_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'project', 'user', 'rox|owner@test.com', '2024-01-01', '2024-01-05', NULL),
    ('10000000-0000-0000-0000-000000000002', 'project', 'user', 'rox|owner@test.com', '2024-01-02', '2024-01-02', NULL),
    ('10000000-0000-0000-0000-000000000003', 'project', 'user', 'rox|owner@test.com', '2024-01-03', '2024-01-03', NULL),
    ('10000000-0000-0000-0000-000000000004', 'project', 'user', 'rox|owner@test.com', '2024-01-04', '2024-01-04', '2024-02-01'),
    ('10000000-0000-0000-0000-000000000005', 'project', 'user', 'rox|owner@test.com', '2024-01-05', '2024-01-06', NULL),
    ('10000000-0000-0000-0000-000000000006', 'project', 'user', 'rox|owner@test.com', '2024-01-06', '2024-01-07', NULL),
    ('10000000-0000-0000-0000-000000000007', 'project', 'user', 'rox|viewer@test.com', '2024-01-07', '2024-01-08', NULL),
    ('10000000-0000-0000-0000-000000000008', 'project', 'user', 'rox|owner@test.com', '2024-01-08', '2024-01-09', NULL),
    ('10000000-0000-0000-0000-000000000009', 'project', 'user', 'rox|owner@test.com', '2024-01-09', '2024-01-10', '2024-02-02'),
    ('20000000-0000-0000-0000-000000000001', 'document', 'user', 'rox|viewer@test.com', '2024-01-03', '2024-01-03', NULL),
    ('20000000-0000-0000-0000-000000000002', 'document', 'user', 'rox|owner@test.com', '2024-01-04', '2024-01-04', '2024-02-01'),
    ('30000000-0000-0000-0000-000000000001', 'chat', 'user', 'rox|owner@test.com', '2024-01-04', '2024-01-04', NULL),
    ('30000000-0000-0000-0000-000000000002', 'chat', 'user', 'rox|owner@test.com', '2024-01-05', '2024-01-05', '2024-02-01');
