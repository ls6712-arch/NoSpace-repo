-- Step 4a · first response — verification.
--
-- Not a migration. Run this AFTER 20261012000000_step4_first_response.sql.
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so the results land in the error message
-- and every fixture row rolls back.
--
-- Fixture rows are written as the connecting (table-owner) role so RLS
-- doesn't get in the way, with request.jwt.claims set to the acting person
-- so auth.uid() (and so notifications.actor_id) is who it would be live.
-- The admin queue is called as 'authenticated', the real caller role.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   INVITER …7201, INVITEE …7202, OTHER (not invited) …7203,
--   LOVER A …7204, LOVER B …7205, ADMIN …7206.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_body text;
  v_href text;
  v_read boolean;
  results text[] := '{}';
  v_owner_role text;
  v_inviter uuid := '00000000-0000-4000-8000-000000007201';
  v_invitee uuid := '00000000-0000-4000-8000-000000007202';
  v_other uuid := '00000000-0000-4000-8000-000000007203';
  v_lover_a uuid := '00000000-0000-4000-8000-000000007204';
  v_lover_b uuid := '00000000-0000-4000-8000-000000007205';
  v_admin uuid := '00000000-0000-4000-8000-000000007206';
  v_private_post bigint;
  v_first_post bigint;
  v_second_post bigint;
  v_other_post bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_inviter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-inviter@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_invitee, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-invitee@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-other@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_lover_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-lovera@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_lover_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-loverb@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step4-admin@step4-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set access = 'active', display_name = 'Step4 Inviter'
    where public.profiles.id = v_inviter;
  update public.profiles set access = 'active', display_name = 'Step4 Invitee', invited_by = v_inviter
    where public.profiles.id = v_invitee;
  update public.profiles set access = 'active', display_name = 'Step4 Other'
    where public.profiles.id = v_other;
  update public.profiles set access = 'active', display_name = 'Step4 Lover A'
    where public.profiles.id = v_lover_a;
  update public.profiles set access = 'active', display_name = 'Step4 Lover B'
    where public.profiles.id = v_lover_b;
  update public.profiles set access = 'active', display_name = 'Step4 Admin', is_admin = true
    where public.profiles.id = v_admin;

  insert into public.profile_follows (follower_id, followed_id, status, responded_at) values
    (v_inviter, v_invitee, 'accepted', now()),
    (v_invitee, v_inviter, 'accepted', now());

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. A just_me moment doesn't count as the first moment.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_invitee), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_invitee, 'pottery', 'photo', 'https://example.test/s4-0.jpg', 'step4 private', 'just_me')
  returning id into v_private_post;

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_inviter and public.notifications.kind = 'first_moment';
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 2-3. The first followers moment notifies the inviter, with the right
  --      body and link.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_invitee, 'pottery', 'photo', 'https://example.test/s4-1.jpg', 'step4 first', 'followers')
  returning id into v_first_post;

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_inviter and public.notifications.kind = 'first_moment';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  v_i := v_i + 1;
  select public.notifications.body, public.notifications.href into v_body, v_href
    from public.notifications
    where public.notifications.user_id = v_inviter and public.notifications.kind = 'first_moment';
  results := array_append(results, format('%s %s', v_i,
    case when v_body = 'Step4 Invitee added their first moment.' and v_href = '/moment/' || v_first_post
         then 'PASS' else 'FAIL body=' || coalesce(v_body, 'null') || ' href=' || coalesce(v_href, 'null') end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 4. A second moment doesn't notify again.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_invitee, 'pottery', 'photo', 'https://example.test/s4-2.jpg', 'step4 second', 'public')
  returning id into v_second_post;

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_inviter and public.notifications.kind = 'first_moment';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5. Someone with no inviter: no first_moment notification at all.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_other, 'running', 'photo', 'https://example.test/s4-3.jpg', 'step4 other', 'public')
  returning id into v_other_post;

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.kind = 'first_moment' and public.notifications.actor_id = v_other;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 6-7. Love from A: one row, "Step4 Lover A loved your moment."
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_lover_a), true);
  insert into public.reactions (post_id, user_id, type) values (v_first_post, v_lover_a, 'love');

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  v_i := v_i + 1;
  select public.notifications.body into v_body from public.notifications
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love';
  results := array_append(results, format('%s %s', v_i,
    case when v_body = 'Step4 Lover A loved your moment.' then 'PASS' else 'FAIL body=' || coalesce(v_body, 'null') end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 8-10. Owner reads it; Love from B updates the same row and marks it
  --       unread again.
  -- ───────────────────────────────────────────────────────────────────────
  update public.notifications set read = true
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love';

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_lover_b), true);
  insert into public.reactions (post_id, user_id, type) values (v_first_post, v_lover_b, 'love');

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  v_i := v_i + 1;
  select public.notifications.body, public.notifications.read into v_body, v_read from public.notifications
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love';
  results := array_append(results, format('%s %s', v_i,
    case when v_body = 'Step4 Lover B and 1 other loved your moment.' then 'PASS' else 'FAIL body=' || coalesce(v_body, 'null') end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when v_read = false then 'PASS' else 'FAIL still read' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11. Count me in doesn't create a love notification; nor does loving
  --     your own moment.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.reactions (post_id, user_id, type) values (v_second_post, v_lover_b, 'in');
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_invitee), true);
  insert into public.reactions (post_id, user_id, type) values (v_second_post, v_invitee, 'love');

  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
    where public.notifications.user_id = v_invitee and public.notifications.kind = 'love'
      and public.notifications.href = '/moment/' || v_second_post;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 12-13. Admin queue lists the invitee's first moment (no written thought
  --        yet); the admin doesn't follow them, and it's followers-only.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);

  v_i := v_i + 1;
  select count(*) into v_n from public.admin_first_moments_waiting() q
    where q.post_id = v_first_post and q.inviter_name = 'Step4 Inviter';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  v_i := v_i + 1;
  select count(*) into v_n from public.admin_first_moments_waiting() q
    where q.post_id = v_first_post and q.admin_can_view = false;
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 14. A blank thought doesn't take it off the queue; a written one does.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  insert into public.thoughts (post_id, user_id, body) values (v_first_post, v_lover_a, '   ');
  perform set_config('role', 'authenticated', true);

  v_i := v_i + 1;
  select count(*) into v_n from public.admin_first_moments_waiting() q where q.post_id = v_first_post;
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL blank thought counted' end));

  perform set_config('role', v_owner_role, true);
  insert into public.thoughts (post_id, user_id, body) values (v_first_post, v_lover_a, 'What made you start?');
  perform set_config('role', 'authenticated', true);

  v_i := v_i + 1;
  select count(*) into v_n from public.admin_first_moments_waiting() q where q.post_id = v_first_post;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL still listed' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 16. A non-admin is refused (42501).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_lover_a), true);
  v_i := v_i + 1;
  begin
    perform public.admin_first_moments_waiting();
    results := array_append(results, format('%s FAIL non-admin read the queue', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
