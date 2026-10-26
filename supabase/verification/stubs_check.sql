-- Soosh: Stubs, the event source (public.stubs, confirm_event_attendance).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261028000000_stubs.sql. Run before it, the script stops at the first
-- check and says so ("NOT APPLIED"); it never creates anything then.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results land
-- in the error message the Editor shows and a rollback is guaranteed whatever
-- happens. Each expected failure is its own begin...exception...end sub-block
-- with strict sqlstate handling (P0001 for a raised message, 42501 for a
-- privilege error); anything else is recorded as 'N ERROR <sqlstate>:
-- <message>', never as a pass. No select-into, no returning-into, no delete
-- (per CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   HOST …4001, GUEST_A …4002, GUEST_B …4003, STRANGER …4004 (no RSVP),
--   MEMBER …4005 (member of the Closed Space), OUTSIDER …4006 (nobody),
--   BANNED …4007 (RSVP row left behind, banned in the Open Space)
--   Spaces: OPEN …00f1, CLOSED …00f2 (both hosted by HOST)
--   Corner: sports-fitness / stubs-check-corner (id read back by slug)
--   Events (titles carry "Stubs check"): OPEN_PAST, OPEN_FUTURE,
--   OPEN_CANCELLED, CLOSED_PAST (ids read back by space + title)
-- Every count and lookup is scoped to those ids, never to a whole live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_corner bigint;
  v_open_past bigint;
  v_open_future bigint;
  v_open_cancelled bigint;
  v_closed_past bigint;
  v_host uuid := '00000000-0000-4000-8000-000000004001';
  v_a uuid := '00000000-0000-4000-8000-000000004002';
  v_b uuid := '00000000-0000-4000-8000-000000004003';
  v_stranger uuid := '00000000-0000-4000-8000-000000004004';
  v_member uuid := '00000000-0000-4000-8000-000000004005';
  v_outsider uuid := '00000000-0000-4000-8000-000000004006';
  v_banned uuid := '00000000-0000-4000-8000-000000004007';
  v_open uuid := '00000000-0000-4000-8000-0000000000f1';
  v_closed uuid := '00000000-0000-4000-8000-0000000000f2';
begin
  v_owner_role := current_user;

  if to_regclass('public.stubs') is null
     or to_regprocedure('public.confirm_event_attendance(bigint, uuid[])') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261028000000_stubs.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-host@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-a@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-b@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-stranger@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-member@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-outsider@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_banned, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stubs-banned@stubs-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.corners (space_slug, slug, name) values ('sports-fitness', 'stubs-check-corner', 'Stubs check corner');
  v_corner := (select c.id from public.corners c where c.space_slug = 'sports-fitness' and c.slug = 'stubs-check-corner');

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, created_by, status)
  values
    (v_open, 'stubs-check-open', 'Stubs check open', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'in_person', 'open', 'immediate', v_host, 'active'),
    (v_closed, 'stubs-check-closed', 'Stubs check closed', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'in_person', 'closed', 'immediate', v_host, 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    (v_open, v_host, 'host', 'active', now() - interval '30 days'),
    (v_closed, v_host, 'host', 'active', now() - interval '30 days'),
    (v_closed, v_member, 'member', 'active', now() - interval '30 days'),
    (v_open, v_banned, 'member', 'banned', now() - interval '30 days');

  insert into public.space_corners (space_id, corner_id, is_primary) values
    (v_open, v_corner, true),
    (v_closed, v_corner, true);

  insert into public.space_events (space_id, title, starts_at, ends_at, timezone, meets, neighborhood, city, created_by, status) values
    (v_open, 'Stubs check open past', now() - interval '3 days', now() - interval '2 days', 'UTC', 'in_person', 'Stubs hood', 'Stubs city', v_host, 'scheduled'),
    (v_open, 'Stubs check open future', now() + interval '3 days', now() + interval '4 days', 'UTC', 'in_person', null, null, v_host, 'scheduled'),
    (v_open, 'Stubs check open cancelled', now() - interval '5 days', now() - interval '4 days', 'UTC', 'in_person', null, null, v_host, 'cancelled'),
    (v_closed, 'Stubs check closed past', now() - interval '3 days', now() - interval '2 days', 'UTC', 'in_person', 'Secret hood', 'Secret city', v_host, 'scheduled');

  v_open_past := (select e.id from public.space_events e where e.space_id = v_open and e.title = 'Stubs check open past');
  v_open_future := (select e.id from public.space_events e where e.space_id = v_open and e.title = 'Stubs check open future');
  v_open_cancelled := (select e.id from public.space_events e where e.space_id = v_open and e.title = 'Stubs check open cancelled');
  v_closed_past := (select e.id from public.space_events e where e.space_id = v_closed and e.title = 'Stubs check closed past');

  insert into public.event_rsvps (event_id, user_id) values
    (v_open_past, v_a), (v_open_past, v_b), (v_open_past, v_banned),
    (v_open_future, v_a),
    (v_open_cancelled, v_a),
    (v_closed_past, v_a), (v_closed_past, v_member);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_host, v_a, v_b, v_stranger, v_member, v_outsider, v_banned));
  results := array_append(results, case when v_n = 7 then format('%s PASS (profiles created for the 7 fixture users)', v_i)
                                        else format('%s FAIL (expected 7 profiles, got %s)', v_i, v_n) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Nobody can give themselves a Stub.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  begin
    insert into public.stubs (user_id, event_id, space_id, issued_by) values (v_a, v_open_past, v_open, v_a);
    results := array_append(results, format('%s FAIL (self insert worked)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (self insert refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- A guest calling the confirm RPC for themselves: not a host.
  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[v_a]);
    results := array_append(results, format('%s FAIL (guest confirmed themselves)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (non-host refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Signed out cannot run it at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[v_a]);
    results := array_append(results, format('%s FAIL (anon ran confirm)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (anon refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- The host's rules.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_future, array[v_a]);
    results := array_append(results, format('%s FAIL (confirmed before the event ended)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (event not over yet)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_cancelled, array[v_a]);
    results := array_append(results, format('%s FAIL (confirmed a cancelled event)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (cancelled event refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[v_host, v_a]);
    results := array_append(results, format('%s FAIL (host confirmed themselves)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (own id refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[v_stranger]);
    results := array_append(results, format('%s FAIL (confirmed someone who never said going)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (no RSVP refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[v_banned]);
    results := array_append(results, format('%s FAIL (confirmed a banned member)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (banned member refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.confirm_event_attendance(v_open_past, array[]::uuid[]);
    results := array_append(results, format('%s FAIL (empty list accepted)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (empty list refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- A refused call must leave nothing behind (every Stub for the fixture events).
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.event_id in (v_open_past, v_open_future, v_open_cancelled, v_closed_past));
  results := array_append(results, case when v_n = 0 then format('%s PASS (no Stubs after the refusals)', v_i)
                                        else format('%s FAIL (%s Stubs after the refusals)', v_i, v_n) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Confirming: one Stub each, idempotent, the Space's primary Corner.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);

  v_i := v_i + 1;
  v_n := public.confirm_event_attendance(v_open_past, array[v_a, v_a]);
  results := array_append(results, case when v_n = 1 then format('%s PASS (one Stub, duplicate id in the list ignored)', v_i)
                                        else format('%s FAIL (issued %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := public.confirm_event_attendance(v_open_past, array[v_a]);
  results := array_append(results, case when v_n = 0 then format('%s PASS (repeat confirm issues nothing)', v_i)
                                        else format('%s FAIL (repeat issued %s)', v_i, v_n) end);

  v_n := public.confirm_event_attendance(v_closed_past, array[v_a, v_member]);
  v_i := v_i + 1;
  results := array_append(results, case when v_n = 2 then format('%s PASS (Closed Space: two Stubs)', v_i)
                                        else format('%s FAIL (issued %s)', v_i, v_n) end);

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s
          where s.event_id = v_open_past and s.user_id = v_a and s.corner_id = v_corner and s.issued_by = v_host and s.space_id = v_open);
  results := array_append(results, case when v_n = 1 then format('%s PASS (Stub carries the primary Corner, host and Space)', v_i)
                                        else format('%s FAIL (matching rows: %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.event_id = v_open_past and s.user_id = v_b);
  results := array_append(results, case when v_n = 0 then format('%s PASS (B was not confirmed, so has no Stub)', v_i)
                                        else format('%s FAIL', v_i) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Who can read the table: you and the hosts, nobody else.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.event_id in (v_open_past, v_closed_past));
  results := array_append(results, case when v_n = 2 then format('%s PASS (A reads their own 2 Stubs)', v_i)
                                        else format('%s FAIL (A sees %s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_outsider), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.event_id in (v_open_past, v_closed_past));
  results := array_append(results, case when v_n = 0 then format('%s PASS (an outsider reads none directly)', v_i)
                                        else format('%s FAIL (outsider sees %s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.event_id in (v_open_past, v_closed_past));
  results := array_append(results, case when v_n = 3 then format('%s PASS (the host reads the 3 they issued)', v_i)
                                        else format('%s FAIL (host sees %s)', v_i, v_n) end);

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
