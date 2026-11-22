INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
('00000000-0000-4000-8000-000000000101', 'first', 'first@example.com', 'cus_fixture_first'),
('00000000-0000-4000-8000-000000000102', 'second', 'second@example.com', 'cus_fixture_second'),
('00000000-0000-4000-8000-000000000103', 'profile', 'profile@example.com', 'cus_fixture_profile');

INSERT INTO "User" (id, email, rox_user_id) VALUES
('rox|first@example.com', 'first@example.com', '00000000-0000-4000-8000-000000000101'),
('rox|second@example.com', 'second@example.com', '00000000-0000-4000-8000-000000000102'),
('rox|profile@example.com', 'profile@example.com', '00000000-0000-4000-8000-000000000103');

INSERT INTO rox_user_info (rox_user_id, first_name, last_name) VALUES
('00000000-0000-4000-8000-000000000103', 'Profile', 'N/A');

INSERT INTO email_links (id, rox_id, fusionauth_user_id, email_address, provider, is_sync_active) VALUES
('00000000-0000-4000-8000-000000000201', 'rox|first@example.com', 'fixture-first', 'first@example.com', 'GMAIL', true),
('00000000-0000-4000-8000-000000000202', 'rox|second@example.com', 'fixture-second', 'second@example.com', 'GMAIL', true);

INSERT INTO email_contacts (id, link_id, email_address, name) VALUES
('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 'external@example.com', 'First Private'),
('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', 'external@example.com', 'Second Private'),
('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000201', 'profile@example.com', 'Do Not Merge'),
('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000202', 'profile@example.com', 'Do Not Merge');

INSERT INTO contacts_connections(user1, user2) VALUES
('rox|external@example.com', 'rox|first@example.com'),
('rox|external@example.com', 'rox|second@example.com'),
('rox|first@example.com', 'rox|profile@example.com'),
('rox|profile@example.com', 'rox|second@example.com'),
('rox|first@example.com', 'rox|unknown@example.com');
