INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id")
(SELECT 'a1111111-1111-1111-1111-111111111111', 'user@user.com', 'user@user.com', 'stripe_id');

INSERT INTO public."User" ("id","email","stripeCustomerId","rox_user_id")
(SELECT 'rox|user@user.com', 'user@user.com','stripe_id', 'a1111111-1111-1111-1111-111111111111');

INSERT INTO public."Project" ("id", "name", "userId", "deletedAt")
(SELECT 'p1', 'a', 'rox|user@user.com', '2019-10-16 00:00:00');

INSERT INTO public."Project" ("id", "name", "userId", "parentId", "deletedAt")
(SELECT 'p2', 'b', 'rox|user@user.com', 'p1', '2019-10-16 00:00:01');

INSERT INTO public."Project" ("id", "name", "userId", "parentId", "deletedAt")
(SELECT 'p3', 'c', 'rox|user@user.com', 'p2', '2019-10-16 00:00:02');

INSERT INTO public."Document" ("id", "name", "fileType", "owner", "deletedAt", "projectId")
(SELECT 'd1', 'd1', 'docx', 'rox|user@user.com', '2019-10-16 00:00:03', 'p1');

INSERT INTO public."DocumentBom" ("id", "documentId")
(SELECT 1, 'd1');

INSERT INTO public."Document" ("id", "name", "fileType", "owner", "deletedAt", "projectId")
(SELECT 'd2', 'd2', 'pdf', 'rox|user@user.com', '2019-10-16 00:00:04', 'p2');

INSERT INTO public."DocumentInstance" ("id", "documentId", "sha")
(SELECT 2, 'd2', 'sha');

INSERT INTO public."Chat" ("id", "name", "userId", "deletedAt", "projectId")
(SELECT 'c1', 'c1', 'rox|user@user.com', '2019-10-16 00:00:05', 'p1');

INSERT INTO public."Chat" ("id", "name", "userId", "deletedAt", "projectId")
(SELECT 'c2', 'c2', 'rox|user@user.com', '2019-10-16 00:00:06', 'p2');
