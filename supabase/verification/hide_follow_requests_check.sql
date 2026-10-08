-- Verifies 20261021000000_hide_follow_requests.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally
-- in RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md); every value is assigned with :=.
--
-- Fixed ids: A ...7b01, B ...7b02, C ...7b03, OUTSIDER ...7b04.
-- Follows: A->B pending, A->C accepted, B->C declined. Every count is scoped to
-- rows whose follower is A, B or C.
-- Run BEFORE the migration it shows the leak (the OUTSIDER checks FAIL).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000007b01';
  v_b uuid := '00000000-0000-4000-8000-000000007b02';
  v_c uuid := '00000000-0000-4000-8000-000000007b03';
  v_out uuid := '00000000-0000-4000-8000-000000007b04';
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'follow-a@follow-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'follow-b@follow-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'follow-c@follow-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_out, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'follow-out@follow-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.profile_follows (follower_id, followed_id, status) values
    (v_a, v_b, 'pending'),
    (v_a, v_c, 'accepted'),
    (v_b, v_c, 'declined');

  -- 1. The policy is still the one select policy on the table, and it looks at status.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_policy p
    where p.polrelid = 'public.profile_follows'::regclass and p.polcmd = 'r'
      and pg_get_expr(p.polqual, p.polrelid) like '%status%');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS one select policy, aware of status' else 'FAIL policies=' || v_n end));

  -- 2. An outsider (logged in, in none of the follows) sees only the accepted one.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_out), true);
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c));
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS outsider sees only accepted' else 'FAIL outsider sees rows=' || v_n end));
  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c) and f.status <> 'accepted');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS outsider sees no pending or declined' else 'FAIL outsider sees non-accepted=' || v_n end));
  perform set_config('role', v_owner_role, true);

  -- 3. The person who asked sees their own pending request (and the accepted
  --    follow), not other people's declined one.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS requester sees own pending + accepted' else 'FAIL requester rows=' || v_n end));
  perform set_config('role', v_owner_role, true);

  -- 4. The person asked sees the request (pending) and their own declined one.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c));
  results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS addressee sees request, own declined, accepted' else 'FAIL B rows=' || v_n end));
  perform set_config('role', v_owner_role, true);

  -- 5. C is asked by two people: sees the accepted and the declined, not A's request to B.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS C sees only follows it is part of, plus accepted' else 'FAIL C rows=' || v_n end));
  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_follows f where f.follower_id = v_a and f.followed_id = v_b);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS C cannot see A asking B' else 'FAIL C saw it' end));
  perform set_config('role', v_owner_role, true);

  -- 6. A logged-out visitor reads nothing.
  v_i := v_i + 1;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_n := (select count(*) from public.profile_follows f where f.follower_id in (v_a, v_b, v_c));
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS anon sees nothing' else 'FAIL anon rows=' || v_n end));
  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
