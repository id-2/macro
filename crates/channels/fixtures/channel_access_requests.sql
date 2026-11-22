-- Fixture for channel access request tests.
--
-- Users: owner and member participate in the private channel; outsider and
-- latecomer do not. Only outsider has a profile name.
-- Channels: ...10 private, ...11 public, ...12 direct message.
INSERT INTO rox_user (id, username, email, stripe_customer_id) VALUES
('00000000-0000-0000-0000-000000000001', 'owner@join.test', 'owner@join.test', 'join_owner'),
('00000000-0000-0000-0000-000000000002', 'member@join.test', 'member@join.test', 'join_member'),
('00000000-0000-0000-0000-000000000003', 'outsider@join.test', 'outsider@join.test', 'join_outsider'),
('00000000-0000-0000-0000-000000000004', 'latecomer@join.test', 'latecomer@join.test', 'join_latecomer');
INSERT INTO "User" (id, email, rox_user_id) VALUES
('rox|owner@join.test', 'owner@join.test', '00000000-0000-0000-0000-000000000001'),
('rox|member@join.test', 'member@join.test', '00000000-0000-0000-0000-000000000002'),
('rox|outsider@join.test', 'outsider@join.test', '00000000-0000-0000-0000-000000000003'),
('rox|latecomer@join.test', 'latecomer@join.test', '00000000-0000-0000-0000-000000000004');
INSERT INTO rox_user_info (rox_user_id, first_name, last_name) VALUES
('00000000-0000-0000-0000-000000000003', 'Olive', 'Outsider');
INSERT INTO comms_channels (id, name, owner_id, channel_type) VALUES
('00000000-0000-0000-0000-000000000010', 'design', 'rox|owner@join.test', 'private'),
('00000000-0000-0000-0000-000000000011', 'general', 'rox|owner@join.test', 'public'),
('00000000-0000-0000-0000-000000000012', NULL, 'rox|owner@join.test', 'direct_message');
INSERT INTO comms_channel_participants (channel_id, user_id, role) VALUES
('00000000-0000-0000-0000-000000000010', 'rox|owner@join.test', 'owner'),
('00000000-0000-0000-0000-000000000010', 'rox|member@join.test', 'member'),
('00000000-0000-0000-0000-000000000012', 'rox|owner@join.test', 'owner'),
('00000000-0000-0000-0000-000000000012', 'rox|member@join.test', 'member');
