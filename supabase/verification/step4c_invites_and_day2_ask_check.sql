-- Step 4c · invites to 3 + Day-2 invite ask — verification.
--
-- Not a migration. Run AFTER 20261013000000_step4c_invites_and_day2_ask.sql.
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO
-- (see CLAUDE.md); every value is assigned with :=.
--
-- Fixed ids: OLD (account > 24h) …7301, NEW (account < 24h) …7302,
-- FRIEND …7303, ADMIN …7304.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_old uuid := '00000000-0000-4000-8000-000000007301';
  v_new uuid := '00000000-0000-4000-8000-000000007302';
  v_friend uuid := '00000000-0000-4000-8000-000000007303';
  v_admin uuid := '00000000-0000-4000-8000-000000007304';
  v_old_post bigint;
  v_new_post bigint;
begin
  v_owner_role := current_user;

  -- 1. Config is 3.
  v_i := v_i + 1;
  v_n := (select (public.app_config.value #>> '{}')::int from public.app_config
    where public.app_config.key = 'invites_per_new_member');
  results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL value=' || coalesce(v_n::text, 'null') end));

  -- 2. No active non-admin account is below 3.
  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles
    where public.profiles.access = 'active'
      and coalesce(public.profiles.is_admin, false) = false
      and public.profiles.invite_allowance < 3);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL below_3=' || v_n end));

  -- Fixture
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_old, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4c-old@step4c-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4c-new@step4c-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_friend, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4c-friend@step4c-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4c-admin@step4c-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set access = 'active', invite_allowance = 3, created_at = now() - interval '2 days'
    where public.profiles.id = v_old;
  update public.profiles set access = 'active', invite_allowance = 3
    where public.profiles.id = v_new;
  update public.profiles set access = 'active'
    where public.profiles.id = v_friend;
  update public.profiles set access = 'active', is_admin = true, created_at = now() - interval '2 days'
    where public.profiles.id = v_admin;

  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_old, 'pottery', 'photo', 'https://example.test/4c-1.jpg', 'step4c old first', 'public');
  v_old_post := (select max(public.posts.id) from public.posts
    where public.posts.user_id = v_old and public.posts.caption = 'step4c old first');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_new, 'pottery', 'photo', 'https://example.test/4c-2.jpg', 'step4c new first', 'public');
  v_new_post := (select max(public.posts.id) from public.posts
    where public.posts.user_id = v_new and public.posts.caption = 'step4c new first');

  perform set_config('role', 'authenticated', true);

  -- 3. No response yet → 0.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_old), true);
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  -- Friend writes a thought on both first moments (and a blank one first).
  perform set_config('role', v_owner_role, true);
  insert into public.thoughts (post_id, user_id, body) values (v_old_post, v_friend, '   ');
  perform set_config('role', 'authenticated', true);

  -- 4. A blank thought doesn't count → still 0.
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  perform set_config('role', v_owner_role, true);
  insert into public.thoughts (post_id, user_id, body) values (v_old_post, v_friend, 'Love the glaze');
  insert into public.thoughts (post_id, user_id, body) values (v_new_post, v_friend, 'Nice start');
  perform set_config('role', 'authenticated', true);

  -- 5. Old account, written response → 3.
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL got=' || v_n end));

  -- 6. Account under 24 hours → 0 even with a response.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_new), true);
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  -- 7. Admin → 0 (they use the admin screen).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  -- 8. After creating one invite → 0 (the ask doesn't repeat).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_old), true);
  perform public.create_invite(null);
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  -- 9. Signed out → 0.
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  v_n := public.my_invite_ask();
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL got=' || v_n end));

  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
