INSERT INTO
    public.rox_user (id, username, email, stripe_customer_id)
VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 'newuser', 'new@user.com', 'cus_new');

INSERT INTO
    public."User" (id, email, rox_user_id)
VALUES
    ('rox|new@user.com', 'new@user.com', 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
