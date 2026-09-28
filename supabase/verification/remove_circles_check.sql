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
--   ADMIN …9001, USER …9002 — Posts 900009001 — fixture-only Space slugs
--   'circle-verify-space-a' / '-b' (never a real Space, so
--   admin_move_space_content's UPDATE can't touch a single real row).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_jsonb jsonb;
  results text[] := '{}';
  v_owner_role text;
  v_sqlstate text;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-7. Every Circle table, column and function is gone.
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

  v_i := v_i + 1;
  select count(*) into v_n from pg_policies
    where schemaname = 'public'
      and ((tablename = 'posts' and policyname = 'circle threads follow the circle''s visibility'));
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL policy still on posts' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000009001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-admin@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000009002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'circle-removal-user@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-000000009001';

  -- ───────────────────────────────────────────────────────────────────────
  -- 8. posts_visibility_check no longer accepts 'circle'.
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
  -- 9. enforce_notification_insert no longer accepts 'circle_invite'.
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
  -- 10-13. space_usage() / admin_move_space_content() no longer mention
  --        circles, and still correctly count/move what they always did.
  --        Fixture-only slugs, never a real Space, so the UPDATE inside
  --        admin_move_space_content can't touch a single real row.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value
    values (900009002, '00000000-0000-4000-8000-000000009002', 'circle-verify-space-a', 'photo', 'https://example.invalid/photo.jpg', 'Fixture post.', 'public');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009001"}', true);

  v_i := v_i + 1;
  begin
    v_jsonb := public.space_usage('circle-verify-space-a');
    results := array_append(results, format('%s %s', v_i,
      case when not (v_jsonb ? 'circles') and (v_jsonb->>'posts')::int = 1 then 'PASS' else 'FAIL ' || v_jsonb::text end));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s', v_i, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    v_jsonb := public.admin_move_space_content('circle-verify-space-a', 'circle-verify-space-b');
    results := array_append(results, format('%s %s', v_i,
      case when not (v_jsonb ? 'circles') and (v_jsonb->>'posts')::int = 1 then 'PASS' else 'FAIL ' || v_jsonb::text end));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s', v_i, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);

  v_i := v_i + 1;
  select count(*) into v_n from public.posts
    where posts.id = 900009002 and posts.hobby_slug = 'circle-verify-space-b';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL post did not move' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
