-- Requires users.sql
-- Top-level projects
INSERT INTO "Project" ("id", "name", "userId", "createdAt", "updatedAt") VALUES
('p1', 'a', 'rox|user@user.com', '2019-10-16 00:00:00', '2019-10-16 00:00:00'),
('p2', 'b', 'rox|user@user.com', '2019-10-16 00:00:00', '2019-10-16 00:00:00');

-- Sub projects of p1
INSERT INTO "Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt") VALUES
('p1a', 'a1', 'rox|user@user.com', 'p1', '2019-10-16 00:00:00', '2019-10-16 01:00:00'),
('p1b', 'a2', 'rox|user@user.com', 'p1', '2019-10-16 00:00:00', '2019-10-16 01:00:00'),
('p1c', 'a3', 'rox|user@user.com', 'p1', '2019-10-16 00:00:00', '2019-10-16 01:00:00'),
('p1d', 'a3', 'rox|user@user.com', 'p1', '2019-10-16 00:00:00', '2019-10-16 01:00:00');

-- Sub projects of p2
INSERT INTO "Project" ("id", "name", "userId", "parentId", "createdAt", "updatedAt") VALUES
('p2a', 'b1', 'rox|user@user.com', 'p2', '2019-10-16 00:00:00', '2019-10-16 01:00:00'),
('p2b', 'b2', 'rox|user@user.com', 'p2', '2019-10-16 00:00:00', '2019-10-16 01:00:00');
