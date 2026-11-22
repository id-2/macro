INSERT INTO public.team ("id", "name", "owner_id", "seat_count")
VALUES ('b2222222-2222-2222-2222-222222222222', 'Test Team', 'rox|test@example.com', 2);

INSERT INTO public.team_user ("team_id", "user_id", "team_role")
VALUES ('b2222222-2222-2222-2222-222222222222', 'rox|test@example.com', 'owner');
