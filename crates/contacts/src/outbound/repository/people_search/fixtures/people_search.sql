INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
('00000000-0000-4000-8000-000000000001', 'viewer', 'viewer@example.com', 'cus_people_viewer'),
('00000000-0000-4000-8000-000000000002', 'teammate', 'teammate@example.com', 'cus_people_teammate'),
('00000000-0000-4000-8000-000000000003', 'contact', 'contact@example.com', 'cus_people_contact'),
('00000000-0000-4000-8000-000000000004', 'stranger', 'stranger@example.com', 'cus_people_stranger'),
('00000000-0000-4000-8000-000000000005', 'other', 'other@example.com', 'cus_people_other'),
('00000000-0000-4000-8000-000000000006', 'ossam', 'ossam@example.com', 'cus_people_ossam');

-- "ossam" is an agent principal; everyone else is a person.
INSERT INTO "User" (id, email, rox_user_id, "isAgent") VALUES
('rox|viewer@example.com', 'viewer@example.com', '00000000-0000-4000-8000-000000000001', false),
('rox|teammate@example.com', 'teammate@example.com', '00000000-0000-4000-8000-000000000002', false),
('rox|contact@example.com', 'contact@example.com', '00000000-0000-4000-8000-000000000003', false),
('rox|stranger@example.com', 'stranger@example.com', '00000000-0000-4000-8000-000000000004', false),
('rox|other@example.com', 'other@example.com', '00000000-0000-4000-8000-000000000005', false),
('rox|ossam@example.com', 'ossam@example.com', '00000000-0000-4000-8000-000000000006', true);

INSERT INTO rox_user_info (rox_user_id, first_name, last_name) VALUES
('00000000-0000-4000-8000-000000000001', 'Viewer', 'Person'),
('00000000-0000-4000-8000-000000000002', 'Sam', 'Rivers'),
('00000000-0000-4000-8000-000000000003', 'Sam', 'Rivera'),
('00000000-0000-4000-8000-000000000004', 'Sam', 'Stranger'),
('00000000-0000-4000-8000-000000000005', 'Sam', 'Other'),
('00000000-0000-4000-8000-000000000006', 'Zed', 'N/A');

INSERT INTO team (id, name, owner_id) VALUES
('00000000-0000-4000-9000-000000000001', 'Viewer team', 'rox|viewer@example.com'),
('00000000-0000-4000-9000-000000000002', 'Other team', 'rox|stranger@example.com');

-- The teammate is not a contact edge: team membership alone makes them searchable.
INSERT INTO team_user (user_id, team_id, team_role) VALUES
('rox|viewer@example.com', '00000000-0000-4000-9000-000000000001', 'owner'),
('rox|teammate@example.com', '00000000-0000-4000-9000-000000000001', 'member'),
('rox|stranger@example.com', '00000000-0000-4000-9000-000000000002', 'owner'),
('rox|other@example.com', '00000000-0000-4000-9000-000000000002', 'member');

INSERT INTO email_links (id, rox_id, fusionauth_user_id, email_address, provider, is_sync_active) VALUES
('00000000-0000-4000-a000-000000000001', 'rox|viewer@example.com', 'people-viewer', 'viewer@example.com', 'GMAIL', true),
('00000000-0000-4000-a000-000000000002', 'rox|stranger@example.com', 'people-stranger', 'stranger@example.com', 'GMAIL', true);

-- Address-book labels are per viewer: the stranger's label never leaks.
INSERT INTO email_contacts (id, link_id, email_address, name) VALUES
('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'samantha.book@example.org', 'Book Sam'),
('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002', 'samantha.book@example.org', 'Stranger Label');

-- Canonical edges (user1 < user2). The stranger knows "other" and a private
-- address; neither is the viewer's contact.
INSERT INTO contacts_connections (user1, user2) VALUES
('rox|contact@example.com', 'rox|viewer@example.com'),
('rox|ossam@example.com', 'rox|viewer@example.com'),
('rox|samantha.book@example.org', 'rox|viewer@example.com'),
('rox|other@example.com', 'rox|stranger@example.com'),
('rox|samuel.private@example.org', 'rox|stranger@example.com');
