-- Soosh: standing_slots (20261119000000_standing_slots.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and everything
-- rolls back. Each expected failure is its own begin...exception...end sub-block with strict
-- sqlstate handling; anything else is recorded as ERROR. No select-into, no returning-into,
-- no delete (CLAUDE.md).
--
-- Fixed ids: ADMIN …9001, HOST …9002 (host of Space …00f9), STRANGER …9003,
-- OTHER …9004 (host of Space …00fa), GUEST …9005 (signed in, access pending, so not a member). Slot titles start with 'vcheck-'; every count is
-- scoped to that prefix.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_admin uuid := '00000000-0000-4000-8000-000000009001';
  v_host uuid := '00000000-0000-4000-8000-000000009002';
  v_stranger uuid := '00000000-0000-4000-8000-000000009003';
  v_other uuid := '00000000-0000-4000-8000-000000009004';
  v_guest uuid := '00000000-0000-4000-8000-000000009005';
  v_space uuid := '00000000-0000-4000-8000-0000000000f9';
  v_space2 uuid := '00000000-0000-4000-8000-0000000000fa';
  v_stale bigint;
  v_host_slot bigint;
  v_verified timestamptz;
begin
  v_owner_role := current_user;

  if to_regclass('public.standing_slots') is null
     or to_regprocedure('private.standing_stale_days()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261119000000_standing_slots.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-admin@slots-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-host@slots-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-stranger@slots-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-other@slots-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-guest@slots-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_admin, v_host, v_stranger, v_other);
  update public.profiles set access = 'pending' where public.profiles.id = v_guest;
  -- A member is an active account with a birthdate (private.is_active); the guest is pending.
  insert into public.profile_private (user_id, birthdate)
  select u.id, date '1990-01-01' from unnest(array[v_admin, v_host, v_stranger, v_other]) as u (id)
  on conflict (user_id) do update set birthdate = excluded.birthdate;
  update public.profiles set is_admin = true where public.profiles.id = v_admin;
  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, created_by, status)
  values (v_space, 'vcheck-slots-space', 'Vcheck slots space', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_host, 'active'),
         (v_space2, 'vcheck-slots-space-2', 'Vcheck slots space 2', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_other, 'active');
  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    (v_space, v_host, 'host', 'active', now()), (v_space2, v_other, 'host', 'active', now());

  -- 1. The config row exists with the proposed 60.
  v_i := v_i + 1;
  v_n := (select (ac.value ->> 'stale_days')::int from public.app_config ac where ac.key = 'standing_slots_v1');
  results := array_append(results, case when v_n = 60 and private.standing_stale_days() = 60 then format('%s PASS (stale_days is 60, from config)', v_i)
                                        else format('%s FAIL (stale_days %s)', v_i, v_n) end);

  -- Admin adds a fresh slot, a stale one (61 days) and an inactive one.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, space_id)
  values ('trivia', 'vcheck-fresh', 'Vcheck bar', 'Greenpoint', 4, '19:00', null);
  insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, last_verified_at)
  values ('trivia', 'vcheck-stale', 'Vcheck bar', 'Greenpoint', 4, '19:00', now() - interval '61 days');
  insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, active)
  values ('trivia', 'vcheck-inactive', 'Vcheck bar', 'Greenpoint', 4, '19:00', false);
  v_stale := (select ss.id from public.standing_slots ss where ss.title = 'vcheck-stale');
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.title like 'vcheck-%');
  results := array_append(results, case when v_n = 3 then format('%s PASS (an admin sees all 3 of their slots)', v_i)
                                        else format('%s FAIL (admin sees %s)', v_i, v_n) end);

  -- 2. A stranger sees only the fresh active one.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.title like 'vcheck-%');
  results := array_append(results, case when v_n = 1 and exists (select 1 from public.standing_slots ss where ss.title = 'vcheck-fresh')
                                        then format('%s PASS (a signed-in stranger sees only the fresh active slot)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  -- 3. A stranger cannot add a slot, with or without a Space.
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time)
    values ('trivia', 'vcheck-stranger-add', 'x', 'x', 1, '10:00');
    results := array_append(results, format('%s FAIL (a stranger added a slot)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a stranger cannot add a slot)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 4. The host adds a slot for their own Space, and can't for nobody's or someone else's.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);
  insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, space_id)
  values ('climbing', 'vcheck-host-own', 'Vcheck gym', 'Gowanus', 2, '18:30', v_space);
  v_host_slot := (select ss.id from public.standing_slots ss where ss.title = 'vcheck-host-own');
  v_i := v_i + 1;
  results := array_append(results, case when v_host_slot is not null then format('%s PASS (a host adds a slot for their own Space)', v_i)
                                        else format('%s FAIL (host slot missing)', v_i) end);
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, space_id)
    values ('climbing', 'vcheck-host-other', 'x', 'x', 2, '18:30', v_space2);
    results := array_append(results, format('%s FAIL (a host added a slot to another Space)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a host cannot add a slot to another Space)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, space_id)
    values ('climbing', 'vcheck-host-nospace', 'x', 'x', 2, '18:30', null);
    results := array_append(results, format('%s FAIL (a host added a slot with no Space)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a host cannot add a slot with no Space)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 5. A host can't move their slot into another Space, and can't touch the admin's slots.
  v_i := v_i + 1;
  begin
    update public.standing_slots set space_id = v_space2 where public.standing_slots.id = v_host_slot;
    results := array_append(results, format('%s FAIL (a host moved a slot to another Space)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a host cannot move a slot to another Space)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  update public.standing_slots set title = 'vcheck-hijacked' where public.standing_slots.title = 'vcheck-fresh';
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.title = 'vcheck-hijacked');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a host cannot edit a slot that is not their Space''s)', v_i)
                                        else format('%s FAIL (edited)', v_i) end);

  -- 6. The host sees their own slot even when it is stale, and "Verified today" brings it back.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  update public.standing_slots set last_verified_at = now() - interval '90 days' where public.standing_slots.id = v_host_slot;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.id = v_host_slot);
  results := array_append(results, case when v_n = 1 then format('%s PASS (a host still sees their own stale slot)', v_i)
                                        else format('%s FAIL (host sees %s)', v_i, v_n) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.id = v_host_slot);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a stranger no longer sees it once it is 90 days old)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);
  update public.standing_slots set last_verified_at = now() where public.standing_slots.id = v_host_slot;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.id = v_host_slot);
  results := array_append(results, case when v_n = 1 then format('%s PASS (verified today: visible again)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  -- 7. A verification date in the future is clamped to now.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  update public.standing_slots set last_verified_at = now() + interval '30 days' where public.standing_slots.id = v_stale;
  v_verified := (select ss.last_verified_at from public.standing_slots ss where ss.id = v_stale);
  v_i := v_i + 1;
  results := array_append(results, case when v_verified <= now() then format('%s PASS (a future verification date is clamped to now)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_verified) end);

  -- 8. Bad values are refused: weekday 7, unknown spend, a half-given location.
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time) values ('trivia', 'vcheck-bad-day', 'x', 'x', 7, '10:00');
    results := array_append(results, format('%s FAIL (weekday 7 allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (weekday 7 is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, spend) values ('trivia', 'vcheck-bad-spend', 'x', 'x', 1, '10:00', 'cheap');
    results := array_append(results, format('%s FAIL (spend cheap allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an unknown spend is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time, lat) values ('trivia', 'vcheck-half-loc', 'x', 'x', 1, '10:00', 40.7);
    results := array_append(results, format('%s FAIL (lat without lng allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (lat without lng is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 9a. A signed-in non-member (access pending) reads nothing and cannot write, even as a host.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_guest), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.standing_slots ss where ss.title like 'vcheck-%');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a non-member reads no slots)', v_i)
                                        else format('%s FAIL (non-member sees %s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into public.standing_slots (corner_slug, title, place_name, area, weekday, start_time)
    values ('trivia', 'vcheck-guest-add', 'x', 'x', 1, '10:00');
    results := array_append(results, format('%s FAIL (a non-member added a slot)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a non-member cannot add a slot)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 9. Signed out (anon) has no access at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.standing_slots ss where ss.title like 'vcheck-%');
    results := array_append(results, format('%s FAIL (anon read the table: %s rows)', v_i, v_n));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (signed out cannot read slots)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
