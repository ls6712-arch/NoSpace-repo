-- Sushii: Spaces Rework — Events RLS/logic simulation.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260927000000_spaces_rework_events.sql.
--
-- Same pattern as the Phase 3/4 scripts: one transaction, one do $$ ... $$
-- block (fixture + every check), ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so results land in the error message the
-- Editor shows and a rollback is guaranteed regardless of outcome.
-- Expected-failure checks are their own begin...exception...end
-- sub-block, classifying what's caught (raise_exception = P0001, one of
-- our own RPCs' raised errors; check_violation = 23514, a table CHECK;
-- insufficient_privilege = 42501, an RLS block; anything else recorded as
-- 'N ERROR <sqlstate>: <message>', never silently treated as a pass).
-- Expected-success calls are NOT wrapped (same as the Phase 4 script's own
-- convention) — an unexpected failure there aborts the whole block and
-- surfaces as a raw Postgres error instead of a RESULTS line, which is
-- itself diagnostic.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   L (Open, events_created_by='hosts'): host L_HOST …2001,
--     non-member L_OUTSIDER …2002 (never joins) — space …0000000000d1
--   M (Closed, events_created_by='hosts'): host M_HOST …2003,
--     member M_MEMBER …2004, non-member M_OUTSIDER …2005
--     — space …0000000000d2
--   N (Closed, events_created_by='members'): host N_HOST …2006,
--     member N_MEMBER …2007 — space …0000000000d3
--   O (read_only from the start): host O_HOST …2008 — space …0000000000d4,
--     with one pre-fixtured scheduled event (inserted directly, since
--     create_event itself is blocked on a read_only Space)
--   P (Closed, membership-exit cleanup): host P_HOST …2009,
--     member P_MEMBER …2010 — space …0000000000d5, with one upcoming and
--     one past event (the past one inserted directly — create_event
--     itself refuses a past starts_at)

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  results text[] := '{}';
  v_owner_role text;
  v_l_event_id bigint;
  v_l_event2_id bigint;
  v_m_event_id bigint;
  v_n_event_id bigint;
  v_o_event_id bigint;
  v_p_event_id bigint;
  v_p_past_event_id bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000002001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-l-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-l-outsider@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-m-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-m-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-m-outsider@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-n-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-n-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-o-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-p-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000002010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5-p-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values
    ('00000000-0000-4000-8000-0000000000d1', 'phase5-test-l', 'Phase 5 Test L', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000002001', 'active'),
    ('00000000-0000-4000-8000-0000000000d2', 'phase5-test-m', 'Phase 5 Test M', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000002003', 'active'),
    ('00000000-0000-4000-8000-0000000000d4', 'phase5-test-o', 'Phase 5 Test O', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000002008', 'read_only'),
    ('00000000-0000-4000-8000-0000000000d5', 'phase5-test-p', 'Phase 5 Test P', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000002009', 'active');

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status, events_created_by)
  values
    ('00000000-0000-4000-8000-0000000000d3', 'phase5-test-n', 'Phase 5 Test N', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000002006', 'active', 'members');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000002001', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000002003', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000002004', 'member', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000002006', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000002007', 'member', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-000000002008', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-000000002009', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-000000002010', 'member', 'active', now() - interval '30 days');

  -- O's pre-fixtured event — direct insert, since create_event refuses a
  -- read_only Space via assert_space_active.
  insert into public.space_events (space_id, title, starts_at, timezone, meets, created_by, status)
  values ('00000000-0000-4000-8000-0000000000d4', 'Phase 5 O Event', now() + interval '3 days', 'America/New_York', 'online', '00000000-0000-4000-8000-000000002008', 'scheduled')
  returning id into v_o_event_id;

  -- P's past event and P_MEMBER's RSVP to it — direct inserts, since
  -- create_event refuses a past starts_at.
  insert into public.space_events (space_id, title, starts_at, timezone, meets, created_by, status)
  values ('00000000-0000-4000-8000-0000000000d5', 'Phase 5 P Past Event', now() - interval '10 days', 'America/New_York', 'online', '00000000-0000-4000-8000-000000002009', 'scheduled')
  returning id into v_p_past_event_id;
  insert into public.event_rsvps (event_id, user_id) values (v_p_past_event_id, '00000000-0000-4000-8000-000000002010');

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. A non-host member can't create an event when the Space's setting is
  --    hosts-only (Space M).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002004"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_event('00000000-0000-4000-8000-0000000000d2', 'M Event', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 2. A non-host member CAN create an event when the setting is 'members'
  --    (Space N).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002007"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000d3', 'N Event', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null) into v_n_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n_event_id is not null then 'PASS' else 'FAIL' end));

  -- 3. create_event refuses a past starts_at.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002006"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_event('00000000-0000-4000-8000-0000000000d3', 'Past Event', null, now() - interval '1 day', null, 'America/New_York', 'online', null, null, null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 4. create_event refuses ends_at < starts_at (the table CHECK).
  v_i := v_i + 1;
  begin
    perform public.create_event('00000000-0000-4000-8000-0000000000d3', 'Bad Range', null, now() + interval '5 days', now() + interval '1 day', 'America/New_York', 'online', null, null, null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 5-9. Open Space (L): non-member sees the event but not the address
  --      until they RSVP; losing the RSVP hides it again.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000d1', 'L Event', null, now() + interval '5 days', null, 'America/New_York', 'in_person', 'Downtown', 'Testville', '123 L St, Testville') into v_l_event_id;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002002"}', true);
  select count(*) into v_n from space_events where space_events.id = v_l_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from event_private_details where event_private_details.event_id = v_l_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  v_i := v_i + 1;
  begin
    perform public.rsvp_to_event(v_l_event_id);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select count(*) into v_n from event_private_details where event_private_details.event_id = v_l_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  perform public.cancel_rsvp(v_l_event_id);
  select count(*) into v_n from event_private_details where event_private_details.event_id = v_l_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 10-15. Closed Space (M): non-member sees nothing directly, gets a
  --        teaser, can't RSVP; an active member can, and already sees the
  --        address via membership.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002003"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000d2', 'M Event', null, now() + interval '5 days', null, 'America/New_York', 'in_person', 'Uptown', 'Testville', '456 M Ave, Testville') into v_m_event_id;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002005"}', true);
  select count(*) into v_n from space_events where space_events.id = v_m_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from event_private_details where event_private_details.event_id = v_m_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from public.list_event_teasers('00000000-0000-4000-8000-0000000000d2');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  v_i := v_i + 1;
  begin
    perform public.rsvp_to_event(v_m_event_id);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002004"}', true);
  v_i := v_i + 1;
  begin
    perform public.rsvp_to_event(v_m_event_id);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select count(*) into v_n from event_private_details where event_private_details.event_id = v_m_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 16-17. Featured-event uniqueness (Space L): featuring a second event
  --        un-features the first.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000d1', 'L Event 2', null, now() + interval '6 days', null, 'America/New_York', 'online', null, null, null) into v_l_event2_id;
  perform public.feature_event(v_l_event_id);
  perform public.feature_event(v_l_event2_id);
  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from space_events
  where space_events.space_id = '00000000-0000-4000-8000-0000000000d1' and space_events.featured;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));
  select featured::text into v_text from space_events where space_events.id = v_l_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'false' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 18-20. Cancelling notifies RSVPs and blocks further RSVPs.
  -- ───────────────────────────────────────────────────────────────────────
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000002004' and notifications.kind = 'space_event_cancelled';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002003"}', true);
  perform public.cancel_event(v_m_event_id);
  perform set_config('role', v_owner_role, true);
  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000002004' and notifications.kind = 'space_event_cancelled';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002004"}', true);
  v_i := v_i + 1;
  begin
    perform public.rsvp_to_event(v_m_event_id);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 21-22. update_event: only a host or the event's creator; M's event was
  --        created by M_HOST, so M_MEMBER (neither) is refused.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.update_event(v_m_event_id, 'Renamed', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002003"}', true);
  perform public.update_event(v_m_event_id, 'M Event Renamed', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null);
  perform set_config('role', v_owner_role, true);
  select title into v_text from space_events where space_events.id = v_m_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'M Event Renamed' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 23-24. read_only Space (O): no new events, no new RSVPs to an event
  --        that already exists there.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002008"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_event('00000000-0000-4000-8000-0000000000d4', 'O Event 2', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.rsvp_to_event(v_o_event_id);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 25-26. Membership-exit cleanup, Closed Space (P): removing a member
  --        drops their RSVP to an upcoming event but keeps a past one.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002009"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000d5', 'P Upcoming Event', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null) into v_p_event_id;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002010"}', true);
  perform public.rsvp_to_event(v_p_event_id);

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002009"}', true);
  perform public.remove_member('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-000000002010');
  perform set_config('role', v_owner_role, true);

  select count(*) into v_n from event_rsvps
  where event_rsvps.event_id = v_p_event_id and event_rsvps.user_id = '00000000-0000-4000-8000-000000002010';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from event_rsvps
  where event_rsvps.event_id = v_p_past_event_id and event_rsvps.user_id = '00000000-0000-4000-8000-000000002010';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
