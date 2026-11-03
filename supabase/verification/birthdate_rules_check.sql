-- Birthday rules (20261111000150_birthdate_rules.sql): locked once set; under 18 drops a member to
-- Stubby only, never deleted.
--
-- Not a migration, nothing here changes the schema or the data for good. Run AFTER the migration
-- (and the member gate before it); run before it, the script stops and says "NOT APPLIED".
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. A ...9801 a member who adds an adult birthday; Y ...9802 a member who gives an
-- under-18 one; G ...9803 a guest. Every count is scoped to these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_r text;
  v_ok boolean;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009801';
  v_y uuid := '00000000-0000-4000-8000-000000009802';
  v_g uuid := '00000000-0000-4000-8000-000000009803';
  v_owner_role text;
begin
  v_owner_role := current_user;
  if to_regprocedure('public.set_my_birthdate(date)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000150_birthdate_rules.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false, u.anon
  from (values (v_a, 'bd.a@acct-test.invalid', false), (v_y, 'bd.y@acct-test.invalid', false), (v_g, null, true)) as u(id, email, anon);
  -- Both onboarded before birthdays were asked: members without a birthdate, like 8 of 9 live.
  -- profiles_require_birthdate refuses false to true without one, so add one, finish, then
  -- clear it as the owner (the birthday lock only stops client roles).
  insert into public.profile_private (user_id, birthdate) select x.id, (current_date - interval '30 years')::date from unnest(array[v_a, v_y]) as x(id)
    on conflict (user_id) do update set birthdate = excluded.birthdate;
  update public.profiles set onboarding_completed = true where profiles.id in (v_a, v_y);
  update public.profile_private set birthdate = null where profile_private.user_id in (v_a, v_y);

  perform set_config('role', 'authenticated', true);

  -- 1. A guest can't set one.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_g), true);
  v_i := v_i + 1;
  begin
    v_r := public.set_my_birthdate(date '1990-05-01');
    results := results || (v_i || ' FAIL a guest set a birthday: ' || v_r);
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a guest can''t set a birthday');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 2. A member sets an adult birthday once; nonsense dates are refused without locking.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_a), true);
  v_r := public.set_my_birthdate((current_date + 1)::date);
  v_i := v_i + 1;
  results := results || (v_i || case when v_r = 'invalid' then ' PASS a date in the future is refused' else ' FAIL future date: ' || v_r end);
  v_r := public.set_my_birthdate((current_date - interval '30 years')::date);
  v_i := v_i + 1;
  results := results || (v_i || case when v_r = 'ok' then ' PASS a member adds an adult birthday' else ' FAIL adult birthday: ' || v_r end);
  v_ok := (public.my_access() ->> 'adult21')::boolean and (public.my_access() ->> 'member')::boolean;
  v_i := v_i + 1;
  results := results || (v_i || case when v_ok then ' PASS they stay a member and get 21+ picks' else ' FAIL member or adult21 lost after adding a birthday' end);

  -- 3. Locked: not again through the function, and not by writing the row directly.
  v_r := public.set_my_birthdate((current_date - interval '40 years')::date);
  v_i := v_i + 1;
  results := results || (v_i || case when v_r = 'locked' then ' PASS a second birthday is refused (locked)' else ' FAIL second birthday: ' || v_r end);
  v_i := v_i + 1;
  begin
    update public.profile_private set birthdate = (current_date - interval '40 years')::date where profile_private.user_id = v_a;
    results := results || (v_i || ' FAIL the birthday was changed with a direct update');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a direct update can''t change it');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    update public.profile_private set birthdate = null where profile_private.user_id = v_a;
    results := results || (v_i || ' FAIL the birthday was cleared with a direct update');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS it can''t be cleared either');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. Under 18: not a member any more, Stubby only, no 21+, and not deleted.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_y), true);
  v_r := public.set_my_birthdate((current_date - interval '16 years')::date);
  v_i := v_i + 1;
  results := results || (v_i || case when v_r = 'under_18' then ' PASS an under-18 date answers under_18' else ' FAIL under-18 date: ' || v_r end);
  v_ok := not (public.my_access() ->> 'member')::boolean and not (public.my_access() ->> 'adult21')::boolean and not (public.my_access() ->> 'guest')::boolean;
  v_i := v_i + 1;
  results := results || (v_i || case when v_ok then ' PASS they drop to Stubby only: not a member, no 21+' else ' FAIL under-18 access is wrong' end);
  perform set_config('request.path', '/rpc/create_space', true);
  v_i := v_i + 1;
  begin
    perform private.request_gate();
    results := results || (v_i || ' FAIL an under-18 account can still create a Space');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS member RPCs are closed to them');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('request.path', '', true);
  v_r := public.set_my_birthdate((current_date - interval '30 years')::date);
  v_i := v_i + 1;
  results := results || (v_i || case when v_r = 'locked' then ' PASS they can''t try another date (locked)' else ' FAIL a second try after under-18: ' || v_r end);
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_y, (current_date - interval '30 years')::date)
      on conflict (user_id) do update set birthdate = excluded.birthdate;
    results := results || (v_i || ' FAIL an adult birthday was written directly after under-18');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS nor write one directly');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  v_n := (select count(*) from public.profiles p where p.id = v_y and p.access = 'under_18' and p.deletion_requested_at is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the account is kept: not deleted, not scheduled for deletion' else ' FAIL the under-18 account was removed or scheduled' end);
  v_n := (select count(*) from public.profile_private pp where pp.user_id = v_y and pp.birthdate is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS the under-18 date itself is not stored' else ' FAIL an under-18 date was stored' end);

  -- 5. Support (the database owner) can still correct a birthday.
  v_i := v_i + 1;
  begin
    update public.profile_private set birthdate = (current_date - interval '31 years')::date where profile_private.user_id = v_a;
    results := results || (v_i || ' PASS support can correct a birthday');
  exception
    when others then results := results || (v_i || ' FAIL support was blocked: ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 6. Only signed-in roles can call it; the gate lets a Stubby account through.
  v_i := v_i + 1;
  results := results || (v_i || case when not has_function_privilege('anon', 'public.set_my_birthdate(date)', 'execute')
                                      and exists (select 1 from private.access_allowlist a where a.kind = 'rpc_account' and a.name = 'set_my_birthdate')
                                 then ' PASS signed out can''t call it; a Stubby account can' else ' FAIL set_my_birthdate grants or allowlist are wrong' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
