-- Soosh core loop v1, PR 3: open-group Pursuits, join requests, sessions.
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261031000000_open_pursuits.sql. Run before it, the script stops at the first
-- check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling (P0001 for a
-- raised message, 42501 for a privilege error, 23514 for a check); anything else is
-- recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   OWNER …6001, A …6002, B …6003, C …6004, D …6005, E …6006 (no relation)
--   Pursuits: OPEN 'open-pursuits-check-open' (capacity 4, Corner fixture
--   check-hobby / check-sub), FRIENDS 'open-pursuits-check-friends'
-- Every count and lookup is scoped to those ids, never to a whole live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_s text;
  results text[] := '{}';
  v_owner_role text;
  v_session bigint;
  v_owner uuid := '00000000-0000-4000-8000-000000006001';
  v_a uuid := '00000000-0000-4000-8000-000000006002';
  v_b uuid := '00000000-0000-4000-8000-000000006003';
  v_c uuid := '00000000-0000-4000-8000-000000006004';
  v_d uuid := '00000000-0000-4000-8000-000000006005';
  v_e uuid := '00000000-0000-4000-8000-000000006006';
begin
  v_owner_role := current_user;

  if to_regclass('public.pursuit_sessions') is null
     or to_regprocedure('public.join_open_pursuit(text)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261031000000_open_pursuits.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-owner@op-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-a@op-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-b@op-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-c@op-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-d@op-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-e@op-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- Accounts are 'pending' until an invite is claimed; the fixture users are active.
  update public.profiles p set access = 'active' where p.id in (v_owner, v_a, v_b, v_c, v_d, v_e);

  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, shared, mode, visibility, capacity, ends_at) values
    ('open-pursuits-check-open', v_owner, 'Open pursuits check', 'check-hobby', 'check-sub', true, 'together', 'open', 4, now() + interval '20 days'),
    ('open-pursuits-check-friends', v_owner, 'Friends pursuits check', 'check-hobby', 'check-sub', false, 'together', 'friends', null, null);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_owner, v_a, v_b, v_c, v_d, v_e) and p.access = 'active');
  results := array_append(results, case when v_n = 6 then format('%s PASS (6 active fixture accounts)', v_i)
                                        else format('%s FAIL (expected 6 active, got %s)', v_i, v_n) end);

  -- An open Pursuit has to be shared and have a capacity.
  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, shared, mode, visibility, capacity)
      values ('open-pursuits-check-bad', v_owner, 'Bad', false, 'together', 'open', 4);
    results := array_append(results, format('%s FAIL (an unshared open Pursuit was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an open Pursuit must be shared)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, shared, mode, visibility, capacity)
      values ('open-pursuits-check-bad2', v_owner, 'Bad', true, 'together', 'open', null);
    results := array_append(results, format('%s FAIL (an open Pursuit with no capacity was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an open Pursuit must have a capacity)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Joining: instant while at most half the 4 spots are taken (the owner counts as 1).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, case when v_s = 'joined' then format('%s PASS (first join is instant)', v_i)
                                          else format('%s FAIL (got %s)', v_i, v_s) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, case when v_s = 'joined' then format('%s PASS (second join is instant: 2 of 4 taken)', v_i)
                                          else format('%s FAIL (got %s)', v_i, v_s) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, case when v_s = 'requested' then format('%s PASS (more than half taken: a request)', v_i)
                                          else format('%s FAIL (got %s)', v_i, v_s) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Joining again changes nothing.
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, case when v_s = 'requested' then format('%s PASS (asking twice is still one request)', v_i)
                                          else format('%s FAIL (got %s)', v_i, v_s) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- A requested person sees their own row and nothing of the group.
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_members m where m.pursuit_id = 'open-pursuits-check-open');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a requester sees only their own member row)', v_i)
                                        else format('%s FAIL (requester sees %s rows)', v_i, v_n) end);

  -- A friends-only Pursuit cannot be joined this way.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_d), true);
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-friends');
    results := array_append(results, format('%s FAIL (joined a friends-only Pursuit: %s)', v_i, v_s));
  exception
    when raise_exception then results := array_append(results, format('%s PASS (a friends-only Pursuit is not open to join)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Discovery: D sees the open Pursuit with its counts and no member list.
  v_i := v_i + 1;
  v_n := (select count(*) from public.open_pursuits_for_corner('check-hobby', 'check-sub', 5) o where o.pursuit_id = 'open-pursuits-check-open' and o.taken = 3 and o.capacity = 4 and jsonb_array_length(o.people) = 3);
  results := array_append(results, case when v_n = 1 then format('%s PASS (discovery shows 3 of 4 taken and 3 people)', v_i)
                                        else format('%s FAIL (matched %s rows)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.open_pursuits_for_corner('check-hobby', 'check-sub', 5) o where o.pursuit_id = 'open-pursuits-check-friends');
  results := array_append(results, case when v_n = 0 then format('%s PASS (friends-only Pursuits are not listed)', v_i)
                                        else format('%s FAIL (listed a friends-only Pursuit)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_members m where m.pursuit_id = 'open-pursuits-check-open');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a stranger reads no member rows directly)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  -- Only the owner answers a request.
  v_i := v_i + 1;
  begin
    perform public.answer_join_request('open-pursuits-check-open', v_c, true);
    results := array_append(results, format('%s FAIL (a stranger answered a request)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (only the host answers a request)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  begin
    perform public.answer_join_request('open-pursuits-check-open', v_c, true);
    v_n := (select count(*) from public.pursuit_members m where m.pursuit_id = 'open-pursuits-check-open' and m.user_id = v_c and m.status = 'joined');
    results := array_append(results, case when v_n = 1 then format('%s PASS (host lets C in)', v_i)
                                          else format('%s FAIL (C is not joined)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Now 4 of 4: full.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_d), true);
  v_i := v_i + 1;
  begin
    v_s := public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, format('%s FAIL (joined a full group: %s)', v_i, v_s));
  exception
    when raise_exception then results := array_append(results, format('%s PASS (a full group refuses)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Sessions: the host sets one, participants read it and say "I'm in", others cannot.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  begin
    insert into public.pursuit_sessions (pursuit_id, starts_at, place, note, created_by)
      values ('open-pursuits-check-open', now() + interval '3 days', 'Priya''s kitchen', 'bring 2 eggs', v_owner);
    v_n := (select count(*) from public.pursuit_sessions s where s.pursuit_id = 'open-pursuits-check-open');
    results := array_append(results, case when v_n = 1 then format('%s PASS (host sets a session)', v_i)
                                          else format('%s FAIL (not saved)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;
  v_session := (select s.id from public.pursuit_sessions s where s.pursuit_id = 'open-pursuits-check-open' order by s.id limit 1);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    insert into public.pursuit_sessions (pursuit_id, starts_at, created_by) values ('open-pursuits-check-open', now() + interval '4 days', v_a);
    results := array_append(results, format('%s FAIL (a member set a session)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot set a session)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.pursuit_session_rsvps (session_id, user_id) values (v_session, v_a);
    v_n := (select count(*) from public.pursuit_session_rsvps r where r.session_id = v_session);
    results := array_append(results, case when v_n = 1 then format('%s PASS (a member says I''m in and sees the count)', v_i)
                                          else format('%s FAIL (count %s)', v_i, v_n) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.pursuit_session_rsvps (session_id, user_id) values (v_session, v_b);
    results := array_append(results, format('%s FAIL (said I''m in for someone else)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (cannot say I''m in for someone else)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_e), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_sessions s where s.pursuit_id = 'open-pursuits-check-open')
       + (select count(*) from public.pursuit_session_rsvps r where r.session_id = v_session);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a stranger reads no sessions or RSVPs)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  v_i := v_i + 1;
  begin
    insert into public.pursuit_session_rsvps (session_id, user_id) values (v_session, v_e);
    results := array_append(results, format('%s FAIL (a stranger said I''m in)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a stranger cannot say I''m in)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Signed out: none of the functions.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform public.join_open_pursuit('open-pursuits-check-open');
    results := array_append(results, format('%s FAIL (anon joined)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot join)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
