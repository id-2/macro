INSERT INTO public."rox_user" ("id", "username", "email", "stripe_customer_id")
VALUES ('a1111111-1111-1111-1111-111111111111', 'user', 'user@user.com', 'stripe_id');

INSERT INTO public."User" ("id", "email", "stripeCustomerId", "rox_user_id")
VALUES ('rox|user@user.com', 'user@user.com', 'stripe_id', 'a1111111-1111-1111-1111-111111111111');

INSERT INTO public."Document" ("id", "name", "fileType", "owner")
VALUES ('document-one', 'document', 'docx', 'rox|user@user.com');
