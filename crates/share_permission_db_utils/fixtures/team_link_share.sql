INSERT INTO rox_user (id, username, email, stripe_customer_id)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'team-scope@user.com', 'team-scope@user.com', 'cus_team_scope'),
    ('b2222222-2222-2222-2222-222222222222', 'public-scope@user.com', 'public-scope@user.com', 'cus_public_scope'),
    ('b3333333-3333-3333-3333-333333333333', 'off-scope@user.com', 'off-scope@user.com', 'cus_off_scope'),
    ('b4444444-4444-4444-4444-444444444444', 'no-team@user.com', 'no-team@user.com', 'cus_no_team');

INSERT INTO "User" (id, email, name, rox_user_id)
VALUES
    ('rox|team-scope@user.com', 'team-scope@user.com', 'Team Scope', 'b1111111-1111-1111-1111-111111111111'),
    ('rox|public-scope@user.com', 'public-scope@user.com', 'Public Scope', 'b2222222-2222-2222-2222-222222222222'),
    ('rox|off-scope@user.com', 'off-scope@user.com', 'Off Scope', 'b3333333-3333-3333-3333-333333333333'),
    ('rox|no-team@user.com', 'no-team@user.com', 'No Team', 'b4444444-4444-4444-4444-444444444444');

INSERT INTO team (id, name, owner_id, seat_count, default_link_share)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'team-default-team', 'rox|team-scope@user.com', 1, 'TEAM'),
    ('c2222222-2222-2222-2222-222222222222', 'team-default-public', 'rox|public-scope@user.com', 1, 'PUBLIC'),
    ('c3333333-3333-3333-3333-333333333333', 'team-default-off', 'rox|off-scope@user.com', 1, NULL);

INSERT INTO team_user (team_id, user_id, team_role)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'rox|team-scope@user.com', 'owner'),
    ('c2222222-2222-2222-2222-222222222222', 'rox|public-scope@user.com', 'owner'),
    ('c3333333-3333-3333-3333-333333333333', 'rox|off-scope@user.com', 'member');
