-- pursuit_person_name() is for the database's own use: 20261202000000_person_name_server_only.sql.
--
-- Not a migration. Run AFTER 20261202000000_person_name_server_only.sql; before it, cases 1 to 4 and 7 fail.
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'.
-- No select-into, no returning-into, no delete (CLAUDE.md). One fixture user (…9421); every lookup is
-- scoped to it.
--
-- Cases:
--   1  a signed-out caller may not run it (privilege)
--   2  a signed-in caller may not run it (privilege)
--   3  calling it signed out is refused
--   4  calling it signed in is refused
--   5  the server's own role still may run it
--   6  the functions that use it still get the name: enforce_notification_insert corrects a wrong actor name
--   7  it is no longer on the non-member allowlist

begin;

do $$
declare
  v_i int := 0;
  v_b boolean;
  v_t text;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009421';
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pns.check.9421@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles p set display_name = 'Check 9421' where p.id = v_a;
  insert into public.profile_private (user_id, birthdate) values (v_a, (current_date - interval '25 years')::date);

  v_b := has_function_privilege('anon', 'public.pursuit_person_name(uuid)', 'execute');
  v_i := v_i + 1;
  results := results || (v_i || case when not v_b then ' PASS signed out may not run it' else ' FAIL anon still has execute' end);

  v_b := has_function_privilege('authenticated', 'public.pursuit_person_name(uuid)', 'execute');
  v_i := v_i + 1;
  results := results || (v_i || case when not v_b then ' PASS signed in may not run it' else ' FAIL authenticated still has execute' end);

  v_i := v_i + 1;
  perform set_config('role', 'anon', true);
  begin
    v_t := public.pursuit_person_name(v_a);
    perform set_config('role', v_owner_role, true);
    results := results || (v_i || ' FAIL signed out got: ' || coalesce(v_t, 'null'));
  exception
    when insufficient_privilege then
      perform set_config('role', v_owner_role, true);
      results := results || (v_i || ' PASS a signed-out call is refused');
    when others then
      perform set_config('role', v_owner_role, true);
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_a), true);
  begin
    v_t := public.pursuit_person_name(v_a);
    perform set_config('role', v_owner_role, true);
    results := results || (v_i || ' FAIL signed in got: ' || coalesce(v_t, 'null'));
  exception
    when insufficient_privilege then
      perform set_config('role', v_owner_role, true);
      results := results || (v_i || ' PASS a signed-in call is refused');
    when others then
      perform set_config('role', v_owner_role, true);
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_b := has_function_privilege('service_role', 'public.pursuit_person_name(uuid)', 'execute');
  v_i := v_i + 1;
  results := results || (v_i || case when v_b then ' PASS the server role still may run it' else ' FAIL service_role lost execute' end);

  -- 6: through the notification trigger, as the signed-in person (the trigger runs as its owner).
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.notifications (user_id, kind, body, actor_name, href)
    values (v_a, 'thought', 'PNS check', 'Not my name', '/home');
    perform set_config('role', v_owner_role, true);
    v_t := (select n.actor_name from public.notifications n where n.user_id = v_a and n.body = 'PNS check');
    results := results || (v_i || case when v_t = 'Check 9421' then ' PASS the notification trigger still reads the name' else ' FAIL actor name is ' || coalesce(v_t, 'null') end);
  exception when others then
    perform set_config('role', v_owner_role, true);
    results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_n := (select count(*) from private.access_allowlist a where a.name = 'pursuit_person_name');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS it is off the non-member allowlist' else ' FAIL still listed ' || v_n || ' times' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
