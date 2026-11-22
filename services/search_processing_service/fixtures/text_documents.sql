INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id")
VALUES ('b2222222-2222-2222-2222-222222222222', 'owner@example.com', 'owner@example.com', 'stripe_id');

INSERT INTO public."User" ("id", "email", "stripeCustomerId", "rox_user_id")
VALUES ('rox|owner@example.com', 'owner@example.com', 'stripe_id', 'b2222222-2222-2222-2222-222222222222');

INSERT INTO public."Document" ("id", "name", "fileType", "owner")
VALUES
    ('htm-document', 'saved page', 'htm', 'rox|owner@example.com'),
    ('html-document', 'web page', 'html', 'rox|owner@example.com'),
    ('md-document', 'notes', 'md', 'rox|owner@example.com');

INSERT INTO public."DocumentInstance" ("revisionName", "documentId", "sha", "createdAt", "updatedAt")
VALUES
    ('saved page', 'htm-document', 'sha-htm', '2019-10-16 00:00:00', '2019-10-16 00:00:00'),
    ('web page', 'html-document', 'sha-html', '2019-10-16 00:00:00', '2019-10-16 00:00:00'),
    ('notes', 'md-document', 'sha-md', '2019-10-16 00:00:00', '2019-10-16 00:00:00');
