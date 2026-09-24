-- Sushii: Spaces Rework Phase 5 — notification fixes.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260929000000_spaces_rework_phase5_notification_fixes.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so
-- results land in the error message the Editor shows and a rollback is
-- guaranteed regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST …4001, RSVP …4002 — Space (Open) …0000000000f1

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_event_id bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000004001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5c-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000004002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5c-rsvp@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values ('00000000-0000-4000-8000-0000000000f1', 'phase5c-test', 'Phase 5c Test', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000004001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000004001', 'host', 'active', now() - interval '30 days');

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-2. Cancelling an event with a 300-char title succeeds (before this
  --      fix, enforce_notification_insert rejected 'space_event_cancelled'
  --      outright regardless of title length — this also exercises that
  --      the kind is now accepted at all), and the resulting notification
  --      is both under 300 chars and carries the truncated (200-char)
  --      title.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004001"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000f1', repeat('A', 300), null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null) into v_event_id;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004002"}', true);
  perform public.rsvp_to_event(v_event_id);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004001"}', true);
  v_i := v_i + 1;
  begin
    perform public.cancel_event(v_event_id);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000004002'
    and notifications.kind = 'space_event_cancelled'
    and notifications.body like ('%' || repeat('A', 200) || '%')
    and char_length(notifications.body) <= 300;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
