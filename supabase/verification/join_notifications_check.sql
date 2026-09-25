-- Sushii: Spaces Rework — join/host-invite notifications.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20261001000000_spaces_rework_join_notifications.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome. Checks that reference a notification's actual
-- wording use `like` around the Space name rather than hardcoding the
-- actor name, since handle_new_user's own default profile fields aren't
-- under test here — except the long-display-name check (11-12), which
-- sets display_name explicitly and checks the exact resulting body.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST1 …6001, HOST2 …6002 — Space CLOSED (Closed) …0000000000f5
--   MEMBER …6003 — active member of CLOSED, invited as co-host
--   REQUESTER …6004 — requests to join CLOSED, later approved
--   REQUESTER_DECLINE …6005 — requests to join CLOSED, later declined
--   HOST_OPEN …6006 — Space OPEN (Open) …0000000000f4
--   REQUESTER_OPEN …6007 — instant-joins OPEN
--   REQUESTER_LONGNAME …6008 — 200-char display_name, requests to join
--     CLOSED (the actor-name-truncation regression check)

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_body text;
  v_href text;
  results text[] := '{}';
  v_owner_role text;
  v_space_open_id uuid := '00000000-0000-4000-8000-0000000000f4';
  v_space_closed_id uuid := '00000000-0000-4000-8000-0000000000f5';
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000006001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-host1@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-host2@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-requester@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-decline@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-hostopen@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-reqopen@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000006008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5f-longname@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- handle_new_user already created this row on the insert above —
  -- overwrite its display_name to exercise the truncation fix.
  update public.profiles set display_name = repeat('A', 200)
  where id = '00000000-0000-4000-8000-000000006008';

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values
    (v_space_open_id, 'phase5f-open', 'Phase 5f Open Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000006006', 'active'),
    (v_space_closed_id, 'phase5f-closed', 'Phase 5f Closed Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000006001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    (v_space_open_id, '00000000-0000-4000-8000-000000006006', 'host', 'active', now() - interval '30 days'),
    (v_space_closed_id, '00000000-0000-4000-8000-000000006001', 'host', 'active', now() - interval '30 days'),
    (v_space_closed_id, '00000000-0000-4000-8000-000000006002', 'host', 'active', now() - interval '30 days'),
    (v_space_closed_id, '00000000-0000-4000-8000-000000006003', 'member', 'active', now() - interval '30 days');

  raise notice '--- fixture ready, running checks ---';

  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. Open-Space instant join writes no notification at all.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006007"}', true);
  perform public.request_or_join_space(v_space_open_id);

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 2-4. Closed-Space request: each active host gets exactly one
  --      space_join_request, correctly worded; neither the requester nor
  --      the Space's non-host member get one.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006004"}', true);
  perform public.request_or_join_space(v_space_closed_id);

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006001' and notifications.kind = 'space_join_request';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006002' and notifications.kind = 'space_join_request';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select notifications.body, notifications.href into v_body, v_href from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006001' and notifications.kind = 'space_join_request';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i,
    case when v_body like '%asked to join Phase 5f Closed Space%' and v_href = '/space/phase5f-closed?tab=manage'
    then 'PASS' else 'FAIL' end));

  select count(*) into v_n from notifications
  where notifications.user_id in ('00000000-0000-4000-8000-000000006003', '00000000-0000-4000-8000-000000006004')
    and notifications.kind = 'space_join_request';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5-6. approve_join_request notifies the requester exactly once,
  --      correctly worded.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006001"}', true);
  perform public.approve_join_request(v_space_closed_id, '00000000-0000-4000-8000-000000006004');

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006004' and notifications.kind = 'space_join_approved';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select notifications.body, notifications.href into v_body, v_href from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006004' and notifications.kind = 'space_join_approved';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i,
    case when v_body = 'You''re in Phase 5f Closed Space.' and v_href = '/space/phase5f-closed'
    then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 7-8. decline_join_request notifies the declined requester exactly
  --      once, correctly worded, with no href.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006005"}', true);
  perform public.request_or_join_space(v_space_closed_id);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006002"}', true);
  perform public.decline_join_request(v_space_closed_id, '00000000-0000-4000-8000-000000006005');

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006005' and notifications.kind = 'space_join_declined';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select notifications.body, notifications.href into v_body, v_href from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006005' and notifications.kind = 'space_join_declined';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i,
    case when v_body = 'Your request to join Phase 5f Closed Space wasn''t approved.' and v_href is null
    then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 9-10. invite_host notifies the invitee exactly once, correctly
  --       worded.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006001"}', true);
  perform public.invite_host(v_space_closed_id, '00000000-0000-4000-8000-000000006003');

  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006003' and notifications.kind = 'space_host_invite';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select notifications.body, notifications.href into v_body, v_href from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006003' and notifications.kind = 'space_host_invite';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i,
    case when v_body like '%invited you to co-host Phase 5f Closed Space%' and v_href = '/space/phase5f-closed'
    then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11-12. A 200-char display_name doesn't break request_or_join_space —
  --        before the left(actor name, 60) fix, this body would have been
  --        ~239 chars just from the uncapped name, and enforce_
  --        notification_insert's 300-char cap would've rejected the
  --        insert outright, failing the whole RPC.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000006008"}', true);
  v_i := v_i + 1;
  begin
    perform public.request_or_join_space(v_space_closed_id);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  select notifications.body into v_body from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000006001' and notifications.kind = 'space_join_request'
    and notifications.body = repeat('A', 60) || ' asked to join Phase 5f Closed Space.';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i,
    case when v_body is not null and char_length(v_body) <= 300 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
