-- Sushii: Spaces Rework — space_moment_pending / space_moment_approved
-- notifications.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20261008000000_spaces_rework_moment_notifications.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST1 …8001, HOST2 …8002, MEMBER …8003 — Space (Open, posting_mode=
--   'approval') …0000000000f6 — Posts 900008001-900008002

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS. The
  -- space_moments inserts below still fire set_space_moment_status() and
  -- notify_space_moment_status() (triggers aren't RLS) — that's the
  -- point, it's under test.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000008001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moment-notif-host1@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000008002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moment-notif-host2@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000008003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moment-notif-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values ('00000000-0000-4000-8000-0000000000f6', 'moment-notif-test', 'Moment Notif Test', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'approval', null, '00000000-0000-4000-8000-000000008001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-000000008001', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-000000008002', 'host', 'active', now() - interval '25 days'),
    ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-000000008003', 'member', 'active', now() - interval '20 days');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    (900008001, '00000000-0000-4000-8000-000000008003', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Member Moment.', 'public'),
    (900008002, '00000000-0000-4000-8000-000000008001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Host''s own Moment.', 'public');

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-3. A member's pending Moment notifies each active host exactly
  --      once — never the member themselves.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000f6', 900008001);

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000008001'
    and notifications.kind = 'space_moment_pending';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL ' || v_n end));

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000008002'
    and notifications.kind = 'space_moment_pending';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL ' || v_n end));

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000008003'
    and notifications.kind = 'space_moment_pending';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 4. A host's own Moment (auto-approved, never pending) notifies
  --    nobody — no new space_moment_pending rows appear.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000f6', 900008002);

  select count(*) into v_n from notifications where notifications.kind = 'space_moment_pending';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5-6. Approving the member's Moment notifies the author exactly once.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008001"}', true);
  v_i := v_i + 1;
  begin
    perform public.approve_space_moment('00000000-0000-4000-8000-0000000000f6', 900008001);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000008003'
    and notifications.kind = 'space_moment_approved';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
