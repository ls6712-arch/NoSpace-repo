-- Soosh: the "start" and "logged" suggestion actions (20261101134316_suggestion_events_start_logged.sql).
--
-- Not a migration, nothing here alters the schema. Run this AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and
-- everything rolls back. Each expected failure is its own begin...exception...end
-- sub-block with strict sqlstate handling; anything else is recorded as ERROR.
-- No select-into, no returning-into, no delete (CLAUDE.md).
--
-- Fixed id (a block no earlier script uses): A …8001, signed in through the
-- request claims so log_suggestion_event() sees auth.uid(). Every count is scoped to
-- A's own rows and the corner key 'sports-fitness/vcheck-start'.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_def text;
  results text[] := '{}';
  v_owner_role text;
  v_a uuid := '00000000-0000-4000-8000-000000008001';
begin
  v_owner_role := current_user;

  v_def := (select pg_get_constraintdef(c.oid) from pg_constraint c
             where c.conrelid = 'public.suggestion_events'::regclass and c.conname = 'suggestion_events_action_check');
  if v_def is null or v_def not like '%''start''%' then
    raise exception 'RESULTS: NOT APPLIED (run 20261101134316_suggestion_events_start_logged.sql first, nothing was created)';
  end if;

  v_i := v_i + 1;
  results := array_append(results, case when v_def like '%''logged''%' then format('%s PASS (the check allows start and logged)', v_i)
                                        else format('%s FAIL (logged missing: %s)', v_i, v_def) end);

  v_i := v_i + 1;
  results := array_append(results, case when v_def like '%''shown''%' and v_def like '%''going''%' and v_def like '%''invite''%' and v_def like '%''dismissed''%'
                                          and v_def like '%''followed''%' and v_def like '%''joined''%' and v_def like '%''tried''%'
                                        then format('%s PASS (every earlier action is still allowed)', v_i)
                                        else format('%s FAIL (an earlier action was dropped: %s)', v_i, v_def) end);

  -- Fixture, as the table owner, signed out.
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@start-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into public.profile_private (user_id, birthdate) values (v_a, date '1990-01-01')
  on conflict (user_id) do update set birthdate = excluded.birthdate;
  update public.profiles set access = 'active' where public.profiles.id = v_a;

  -- A, signed in, writes through the one function the app uses.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  perform public.log_suggestion_event('at_home', 'sports-fitness/vcheck-start', 'sports-fitness/vcheck-start', 0, null, '{}', 'start');
  perform public.log_suggestion_event('at_home', 'sports-fitness/vcheck-start', 'sports-fitness/vcheck-start', 0, null, '{}', 'going');
  perform public.log_suggestion_event('at_home', 'sports-fitness/vcheck-start', 'sports-fitness/vcheck-start', 0, null, '{}', 'logged');

  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.suggestion_events se
           where se.user_id = v_a and se.corner_key = 'sports-fitness/vcheck-start' and se.action in ('start', 'going', 'logged'));
  results := array_append(results, case when v_n = 3 then format('%s PASS (start, going and logged each wrote one row)', v_i)
                                        else format('%s FAIL (expected 3 rows, got %s)', v_i, v_n) end);

  -- An action that is not on the list is still refused, with the check violation and nothing else.
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
    perform public.log_suggestion_event('at_home', 'sports-fitness/vcheck-start', 'sports-fitness/vcheck-start', 0, null, '{}', 'vcheck-bogus');
    results := array_append(results, format('%s FAIL (an unknown action was accepted)', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS (an unknown action is refused with check_violation)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (sqlstate %s: %s)', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.suggestion_events se where se.user_id = v_a and se.action = 'vcheck-bogus');
  results := array_append(results, case when v_n = 0 then format('%s PASS (the refused action left no row)', v_i)
                                        else format('%s FAIL (%s rows)', v_i, v_n) end);

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
