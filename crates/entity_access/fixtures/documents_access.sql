-- SQL fixture for the batched document access check
-- (`AccessRepository::get_documents_access`): one document per way
-- `get_document_access` grants or refuses access, so the two can be compared.
--
-- People:
--   viewer    member of the viewer team; in the viewer channel; left the left channel
--   teammate  owner of the viewer team
--   stranger  owner of the other team; in the viewer channel
--   outsider  no team and no channel
--
-- Documents d...NN, with what the viewer gets:
--   01 own document, owner grant                                  owner
--   02 view grant                                                 view
--   03 edit grant and a public view link                          edit
--   04 public comment link                                        comment
--   05 team edit link from a teammate                             edit
--   06 team view link from another team                           none
--   07 comment grant to the viewer channel                        comment
--   08 edit grant to a channel the viewer left                    none
--   09 view grant to the viewer team                              view
--   10 edit grant to the outsider only                            none
--   11 attachment in the viewer's own inbox                       edit
--   12 attachment in an inbox delegated to the viewer             edit
--   13 attachment in a thread granted to the viewer channel       view
--   14 attachment in the outsider's inbox, no grant               none
--   15 discussion attachment on 01 (viewer owns the parent)       view
--   16 discussion attachment in a reply on 09 (team grant)        view
--   17 discussion attachment on 04 (public parent)                view
--   18 discussion attachment on 05 (team link parent)             view
--   19 discussion attachment, message deleted                     none
--   20 discussion attachment, thread deleted                      none
--   21 discussion attachment on 22 (parent deleted)               none
--   22 deleted document, owner grant                              owner
--   23 discussion attachment on 06 (parent the viewer can't see)  none
--   24 view grant, no document row                                view
--   25 nothing at all                                             none
--   26 stranger's document, no grant                              none
-- Legacy (non-UUID) ids:
--   legacy-owned   the viewer owns it                             owner
--   legacy-public  public view link                               view
--   legacy-missing no document row                                none

INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'viewer',   'viewer@batch.test',   'cus_batch_viewer'),
    ('a0000000-0000-0000-0000-000000000002', 'teammate', 'teammate@batch.test', 'cus_batch_teammate'),
    ('a0000000-0000-0000-0000-000000000003', 'stranger', 'stranger@batch.test', 'cus_batch_stranger'),
    ('a0000000-0000-0000-0000-000000000004', 'outsider', 'outsider@batch.test', 'cus_batch_outsider');

INSERT INTO "User" (id, email, rox_user_id) VALUES
    ('rox|viewer@batch.test',   'viewer@batch.test',   'a0000000-0000-0000-0000-000000000001'),
    ('rox|teammate@batch.test', 'teammate@batch.test', 'a0000000-0000-0000-0000-000000000002'),
    ('rox|stranger@batch.test', 'stranger@batch.test', 'a0000000-0000-0000-0000-000000000003'),
    ('rox|outsider@batch.test', 'outsider@batch.test', 'a0000000-0000-0000-0000-000000000004');

INSERT INTO team (id, name, owner_id) VALUES
    ('b0000000-0000-0000-0000-00000000ea01', 'Viewer Team', 'rox|teammate@batch.test'),
    ('b0000000-0000-0000-0000-00000000ea02', 'Other Team',  'rox|stranger@batch.test');

INSERT INTO team_user (user_id, team_id, team_role) VALUES
    ('rox|viewer@batch.test',   'b0000000-0000-0000-0000-00000000ea01', 'member'),
    ('rox|teammate@batch.test', 'b0000000-0000-0000-0000-00000000ea01', 'owner'),
    ('rox|stranger@batch.test', 'b0000000-0000-0000-0000-00000000ea02', 'owner');

INSERT INTO comms_channels (id, channel_type, owner_id) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'private', 'rox|stranger@batch.test'),
    ('c0000000-0000-0000-0000-000000000002', 'private', 'rox|stranger@batch.test');

INSERT INTO comms_channel_participants (channel_id, role, user_id, left_at) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'owner',  'rox|stranger@batch.test', NULL),
    ('c0000000-0000-0000-0000-000000000001', 'member', 'rox|viewer@batch.test',   NULL),
    ('c0000000-0000-0000-0000-000000000002', 'member', 'rox|viewer@batch.test',   now());

INSERT INTO "Document" (id, name, owner, "deletedAt") VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Own',                 'rox|viewer@batch.test',   NULL),
    ('d0000000-0000-0000-0000-000000000002', 'View grant',          'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000003', 'Edit and public',     'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000004', 'Public comment',      'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000005', 'Teammate team link',  'rox|teammate@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000006', 'Other team link',     'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000007', 'Channel grant',       'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000008', 'Left channel grant',  'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000009', 'Team grant',          'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000010', 'Outsider grant',      'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000011', 'Own inbox',           'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000012', 'Delegated inbox',     'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000013', 'Thread grant',        'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000014', 'Unrelated email',     'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000015', 'On own parent',       'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000016', 'In a reply',          'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000017', 'On public parent',    'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000018', 'On team link parent', 'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000019', 'Deleted message',     'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000020', 'Deleted thread',      'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000021', 'On deleted parent',   'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000022', 'Deleted',             'rox|viewer@batch.test',   now()),
    ('d0000000-0000-0000-0000-000000000023', 'On hidden parent',    'rox|stranger@batch.test', NULL),
    ('d0000000-0000-0000-0000-000000000026', 'Stranger only',       'rox|stranger@batch.test', NULL),
    ('legacy-owned',                         'Legacy owned',        'rox|viewer@batch.test',   NULL),
    ('legacy-public',                        'Legacy public',       'rox|stranger@batch.test', NULL);

INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'document', 'rox|viewer@batch.test',              'user',    'owner'),
    ('d0000000-0000-0000-0000-000000000002', 'document', 'rox|viewer@batch.test',              'user',    'view'),
    ('d0000000-0000-0000-0000-000000000002', 'document', 'rox|stranger@batch.test',            'user',    'owner'),
    ('d0000000-0000-0000-0000-000000000003', 'document', 'rox|viewer@batch.test',              'user',    'edit'),
    ('d0000000-0000-0000-0000-000000000007', 'document', 'c0000000-0000-0000-0000-000000000001', 'channel', 'comment'),
    ('d0000000-0000-0000-0000-000000000008', 'document', 'c0000000-0000-0000-0000-000000000002', 'channel', 'edit'),
    ('d0000000-0000-0000-0000-000000000009', 'document', 'b0000000-0000-0000-0000-00000000ea01', 'team',    'view'),
    ('d0000000-0000-0000-0000-000000000010', 'document', 'rox|outsider@batch.test',            'user',    'edit'),
    ('d0000000-0000-0000-0000-000000000022', 'document', 'rox|viewer@batch.test',              'user',    'owner'),
    ('d0000000-0000-0000-0000-000000000024', 'document', 'rox|viewer@batch.test',              'user',    'view');

INSERT INTO "SharePermission" (id, "linkShare", "linkShareAccessLevel") VALUES
    ('share-03',     'PUBLIC', 'view'),
    ('share-04',     'PUBLIC', 'comment'),
    ('share-05',     'TEAM',   'edit'),
    ('share-06',     'TEAM',   'view'),
    ('share-legacy', 'PUBLIC', 'view');

INSERT INTO "DocumentPermission" ("documentId", "sharePermissionId") VALUES
    ('d0000000-0000-0000-0000-000000000003', 'share-03'),
    ('d0000000-0000-0000-0000-000000000004', 'share-04'),
    ('d0000000-0000-0000-0000-000000000005', 'share-05'),
    ('d0000000-0000-0000-0000-000000000006', 'share-06'),
    ('legacy-public',                        'share-legacy');

-- Inboxes: e1...01 the viewer's, e1...02 the stranger's (delegated to the
-- viewer), e1...03 the outsider's.
INSERT INTO email_links (id, rox_id, fusionauth_user_id, email_address, provider) VALUES
    ('e1000000-0000-0000-0000-000000000001', 'rox|viewer@batch.test',   'rox|viewer@batch.test',   'viewer@mail.test',   'GMAIL'),
    ('e1000000-0000-0000-0000-000000000002', 'rox|stranger@batch.test', 'rox|stranger@batch.test', 'stranger@mail.test', 'GMAIL'),
    ('e1000000-0000-0000-0000-000000000003', 'rox|outsider@batch.test', 'rox|outsider@batch.test', 'outsider@mail.test', 'GMAIL');

INSERT INTO rox_user_links (primary_rox_id, child_rox_id, link_id) VALUES
    ('rox|viewer@batch.test', 'rox|stranger@batch.test', 'e1000000-0000-0000-0000-000000000002');

INSERT INTO email_threads (id, link_id) VALUES
    ('e2000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000001'),
    ('e2000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000002'),
    ('e2000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000003'),
    ('e2000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000003');

INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level) VALUES
    ('e2000000-0000-0000-0000-000000000013', 'email_thread', 'c0000000-0000-0000-0000-000000000001', 'channel', 'edit');

INSERT INTO email_messages (id, thread_id, link_id) VALUES
    ('e3000000-0000-0000-0000-000000000011', 'e2000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000001'),
    ('e3000000-0000-0000-0000-000000000012', 'e2000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000002'),
    ('e3000000-0000-0000-0000-000000000013', 'e2000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000003'),
    ('e3000000-0000-0000-0000-000000000014', 'e2000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000003');

INSERT INTO email_attachments (id, message_id, provider_attachment_id, filename, mime_type) VALUES
    ('e4000000-0000-0000-0000-000000000011', 'e3000000-0000-0000-0000-000000000011', 'attachment-11', 'a.pdf', 'application/pdf'),
    ('e4000000-0000-0000-0000-000000000012', 'e3000000-0000-0000-0000-000000000012', 'attachment-12', 'b.pdf', 'application/pdf'),
    ('e4000000-0000-0000-0000-000000000013', 'e3000000-0000-0000-0000-000000000013', 'attachment-13', 'c.pdf', 'application/pdf'),
    ('e4000000-0000-0000-0000-000000000014', 'e3000000-0000-0000-0000-000000000014', 'attachment-14', 'd.pdf', 'application/pdf');

INSERT INTO document_email (document_id, email_attachment_id) VALUES
    ('d0000000-0000-0000-0000-000000000011', 'e4000000-0000-0000-0000-000000000011'),
    ('d0000000-0000-0000-0000-000000000012', 'e4000000-0000-0000-0000-000000000012'),
    ('d0000000-0000-0000-0000-000000000013', 'e4000000-0000-0000-0000-000000000013'),
    ('d0000000-0000-0000-0000-000000000014', 'e4000000-0000-0000-0000-000000000014');

-- Discussion messages: f1...NN carries the attachment for document NN. The
-- reply f1...16 sits in the thread rooted at f1...61.
INSERT INTO comms_messages (id, sender_id, content, parent_entity_type, parent_entity_id, thread_id, deleted_at) VALUES
    ('f1000000-0000-0000-0000-000000000015', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000001', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000061', 'rox|stranger@batch.test', 'root', 'document', 'd0000000-0000-0000-0000-000000000009', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000016', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000061', NULL),
    ('f1000000-0000-0000-0000-000000000017', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000004', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000018', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000005', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000019', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000001', NULL, now()),
    ('f1000000-0000-0000-0000-000000000020', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000001', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000021', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000022', NULL, NULL),
    ('f1000000-0000-0000-0000-000000000023', 'rox|stranger@batch.test', 'file', 'document', 'd0000000-0000-0000-0000-000000000006', NULL, NULL);

UPDATE comms_message_threads SET deleted_at = now()
WHERE root_id = 'f1000000-0000-0000-0000-000000000020';

INSERT INTO comms_attachments (id, message_id, entity_type, entity_id) VALUES
    ('f2000000-0000-0000-0000-000000000015', 'f1000000-0000-0000-0000-000000000015', 'document', 'd0000000-0000-0000-0000-000000000015'),
    ('f2000000-0000-0000-0000-000000000016', 'f1000000-0000-0000-0000-000000000016', 'document', 'd0000000-0000-0000-0000-000000000016'),
    ('f2000000-0000-0000-0000-000000000017', 'f1000000-0000-0000-0000-000000000017', 'document', 'd0000000-0000-0000-0000-000000000017'),
    ('f2000000-0000-0000-0000-000000000018', 'f1000000-0000-0000-0000-000000000018', 'document', 'd0000000-0000-0000-0000-000000000018'),
    ('f2000000-0000-0000-0000-000000000019', 'f1000000-0000-0000-0000-000000000019', 'document', 'd0000000-0000-0000-0000-000000000019'),
    ('f2000000-0000-0000-0000-000000000020', 'f1000000-0000-0000-0000-000000000020', 'document', 'd0000000-0000-0000-0000-000000000020'),
    ('f2000000-0000-0000-0000-000000000021', 'f1000000-0000-0000-0000-000000000021', 'document', 'd0000000-0000-0000-0000-000000000021'),
    ('f2000000-0000-0000-0000-000000000023', 'f1000000-0000-0000-0000-000000000023', 'document', 'd0000000-0000-0000-0000-000000000023');
