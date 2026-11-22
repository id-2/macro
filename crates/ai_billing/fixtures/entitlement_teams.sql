INSERT INTO "rox_user" (id, username, email, stripe_customer_id)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'paid-owner@example.com', 'paid-owner@example.com', 'cus_paid_owner'),
    ('b2222222-2222-2222-2222-222222222222', 'paid-member@example.com', 'paid-member@example.com', 'cus_paid_member'),
    ('b3333333-3333-3333-3333-333333333333', 'canceled-owner@example.com', 'canceled-owner@example.com', 'cus_canceled_owner'),
    ('b4444444-4444-4444-4444-444444444444', 'canceled-member@example.com', 'canceled-member@example.com', 'cus_canceled_member'),
    ('b5555555-5555-5555-5555-555555555555', 'enterprise-owner@example.com', 'enterprise-owner@example.com', 'cus_enterprise_owner'),
    ('b6666666-6666-6666-6666-666666666666', 'enterprise-member@example.com', 'enterprise-member@example.com', 'cus_enterprise_member');

INSERT INTO "User" ("id", "email", "name", "stripeCustomerId", "rox_user_id")
VALUES
    ('rox|paid-owner@example.com', 'paid-owner@example.com', 'Paid Owner', NULL, 'b1111111-1111-1111-1111-111111111111'),
    ('rox|paid-member@example.com', 'paid-member@example.com', 'Paid Member', NULL, 'b2222222-2222-2222-2222-222222222222'),
    ('rox|canceled-owner@example.com', 'canceled-owner@example.com', 'Canceled Owner', NULL, 'b3333333-3333-3333-3333-333333333333'),
    ('rox|canceled-member@example.com', 'canceled-member@example.com', 'Canceled Member', 'cus_canceled_member', 'b4444444-4444-4444-4444-444444444444'),
    ('rox|enterprise-owner@example.com', 'enterprise-owner@example.com', 'Enterprise Owner', NULL, 'b5555555-5555-5555-5555-555555555555'),
    ('rox|enterprise-member@example.com', 'enterprise-member@example.com', 'Enterprise Member', NULL, 'b6666666-6666-6666-6666-666666666666');

-- The canceled team keeps the id of its ended subscription, as the Stripe
-- webhook leaves it.
INSERT INTO team (id, name, owner_id, subscription_id, seat_count, paying)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'paid', 'rox|paid-owner@example.com', 'sub_paid', 2, true),
    ('22222222-2222-2222-2222-222222222222', 'canceled', 'rox|canceled-owner@example.com', 'sub_canceled', 2, false);

INSERT INTO team (id, name, owner_id, seat_count, paying, enterprise)
VALUES ('33333333-3333-3333-3333-333333333333', 'enterprise', 'rox|enterprise-owner@example.com', 2, false, true);

INSERT INTO team_user (team_id, user_id, team_role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'rox|paid-owner@example.com', 'owner'),
    ('11111111-1111-1111-1111-111111111111', 'rox|paid-member@example.com', 'member'),
    ('22222222-2222-2222-2222-222222222222', 'rox|canceled-owner@example.com', 'owner'),
    ('22222222-2222-2222-2222-222222222222', 'rox|canceled-member@example.com', 'member'),
    ('33333333-3333-3333-3333-333333333333', 'rox|enterprise-owner@example.com', 'owner'),
    ('33333333-3333-3333-3333-333333333333', 'rox|enterprise-member@example.com', 'member');
