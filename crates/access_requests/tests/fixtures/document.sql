INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
('00000000-0000-0000-0000-000000000001', 'owner@requests.test', 'owner@requests.test', 'owner'),
('00000000-0000-0000-0000-000000000002', 'reader@requests.test', 'reader@requests.test', 'reader'),
('00000000-0000-0000-0000-000000000003', 'outsider@requests.test', 'outsider@requests.test', 'outsider');
INSERT INTO "User" (id, email, rox_user_id) VALUES
('rox|owner@requests.test', 'owner@requests.test', '00000000-0000-0000-0000-000000000001'),
('rox|reader@requests.test', 'reader@requests.test', '00000000-0000-0000-0000-000000000002'),
('rox|outsider@requests.test', 'outsider@requests.test', '00000000-0000-0000-0000-000000000003');
INSERT INTO "Document" (id, name, owner, "fileType") VALUES
('00000000-0000-0000-0000-000000000010', 'Shared document', 'rox|owner@requests.test', 'md');
INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level) VALUES
('00000000-0000-0000-0000-000000000010', 'document', 'rox|owner@requests.test', 'user', 'owner'),
('00000000-0000-0000-0000-000000000010', 'document', 'rox|reader@requests.test', 'user', 'view');
