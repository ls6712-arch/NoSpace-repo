-- Sushii: Phase 6 — remove Circles. Verification.
--
-- Not a migration — nothing here should alter the schema (a few INSERTs are
-- fixture data, rolled back unconditionally at the end). Run this AFTER
-- 20261009000000_remove_circles.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   ADMIN …9001, AUTHOR …9002, FOLLOWER …9003, STRANGER …9004 — Posts
--   900009001-900009003 — fixture-only Space slugs 'circle-verify-space-a'
--   / '-b' (never a real Space, so admin_move_space_content's UPDATE can't
--   touch a single real row).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_jsonb jsonb;
  v_text text;
  results text[] := '{}';
  v_owner_role text;
  v_sqlstate text;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-6. Every Circle table, column and function is gone.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when to_regclass('public.circles') is null then 'PASS' else 'FAIL still exists' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when to_regclass('public.circle_members') is null then 'PASS' else 'FAIL still exists' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when to_regclass('public.circle_invites') is null then 'PASS' else 'FAIL still exists' end));

  v_i := v_i + 1;
  select count(*) into v_n from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name in ('circle_id', 'circle_tab', 'answered', 'hidden_from_moments');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL ' || v_n || ' column(s) remain' end));

  v_i := v_i + 1;
  select count(*) into v_n from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'owns_circle', 'is_circle_member', 'real_circle_member_counts',
        'circle_member_counts', 'circle_usage', 'admin_delete_circle',
        'set_thread_answered', 'rl_circles', 'rl_circle_members', 'rl_circle_invites'
      );
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL ' || v_n || ' function(s) remain' end));

  -- "posts are readable by their audience" still exists (re-created, not
  -- dropped) and its qual no longer mentions circles at all.
  v_i := v_i + 1;
  select qual into v_text from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'posts are readable by their audience' and cmd = 'SELECT';
  results := array_append(results, format('%s %s', v_i,
    case
      when v_text is null then 'FAIL policy missing'
      when v_text ilike '%circle%' then 'FAIL qual still mentions circle'
      else 'PASS'
    end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000009001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-admin@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000009002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-author@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000009003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-follower@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000009004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-stranger@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-000000009001';

  -- FOLLOWER (…9003) follows AUTHOR (…9002), already accepted — the fixture
  -- for the followers-branch read checks below.
  insert into public.profile_follows (follower_id, followed_id, status)
    values ('00000000-0000-4000-8000-000000009003', '00000000-0000-4000-8000-000000009002', 'accepted');

  -- ───────────────────────────────────────────────────────────────────────
  -- 7. posts_visibility_check no longer accepts 'circle'.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value
      values (900009001, '00000000-0000-4000-8000-000000009002', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Should never land.', 'circle');
    results := array_append(results, format('%s FAIL insert succeeded, should have violated the check', v_i));
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s %s', v_i, case when v_sqlstate = '23514' then 'PASS' else 'FAIL wrong SQLSTATE ' || v_sqlstate end));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 8. enforce_notification_insert no longer accepts 'circle_invite'.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    insert into public.notifications (user_id, kind, body)
      values ('00000000-0000-4000-8000-000000009002', 'circle_invite', 'Should never land.');
    results := array_append(results, format('%s FAIL insert succeeded, should have been rejected', v_i));
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s %s', v_i, case when v_sqlstate = 'P0001' then 'PASS' else 'FAIL wrong SQLSTATE ' || v_sqlstate end));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 9-12. "posts are readable by their audience" still does exactly what
  --        it did before, minus circles: own post readable regardless of
  --        visibility, public readable by a stranger, followers-only
  --        readable by an accepted follower and NOT by a stranger.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value
    values (900009002, '00000000-0000-4000-8000-000000009002', 'circle-verify-space-a', 'photo', 'https://example.invalid/photo.jpg', 'Public fixture post.', 'public'),
           (900009003, '00000000-0000-4000-8000-000000009002', 'circle-verify-space-a', 'photo', 'https://example.invalid/photo.jpg', 'Followers-only fixture post.', 'followers');

  -- AUTHOR sees their own followers-only post.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002"}', true);
  select count(*) into v_n from public.posts where posts.id = 900009003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL author can''t see own post' end));

  -- FOLLOWER (accepted) sees the followers-only post.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900009003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL follower can''t see it' end));

  -- STRANGER (no follow) does NOT see the followers-only post...
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009004"}', true);
  select count(*) into v_n from public.posts where posts.id = 900009003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL stranger can see it' end));

  -- ...but DOES see the public post.
  select count(*) into v_n from public.posts where posts.id = 900009002;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL stranger can''t see public post' end));

  perform set_config('role', v_owner_role, true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 13-15. space_usage() / admin_move_space_content() no longer mention
  --        circles, and still correctly count/move what they always did.
  --        Fixture-only slugs, never a real Space, so the UPDATE inside
  --        admin_move_space_content can't touch a single real row.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009001"}', true);

  v_i := v_i + 1;
  begin
    v_jsonb := public.space_usage('circle-verify-space-a');
    results := array_append(results, format('%s %s', v_i,
      case when not (v_jsonb ? 'circles') and (v_jsonb->>'posts')::int = 2 then 'PASS' else 'FAIL ' || v_jsonb::text end));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s', v_i, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    v_jsonb := public.admin_move_space_content('circle-verify-space-a', 'circle-verify-space-b');
    results := array_append(results, format('%s %s', v_i,
      case when not (v_jsonb ? 'circles') and (v_jsonb->>'posts')::int = 2 then 'PASS' else 'FAIL ' || v_jsonb::text end));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s', v_i, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);

  v_i := v_i + 1;
  select count(*) into v_n from public.posts
    where posts.hobby_slug = 'circle-verify-space-b' and posts.id in (900009002, 900009003);
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL posts did not move' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
