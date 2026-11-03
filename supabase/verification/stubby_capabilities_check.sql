-- TEST PROJECT ONLY. Always rolls back. Owner/other fixtures require existing test users.
begin;
do $$
declare
  results text[] := array[]::text[];
  owner_id uuid := (select users.id from auth.users as users where not coalesce(users.is_anonymous, false) order by users.id limit 1);
  other_id uuid := (select users.id from auth.users as users where not coalesce(users.is_anonymous, false) order by users.id offset 1 limit 1);
  n integer;
begin
  if owner_id is null or other_id is null then
    results := array_append(results, 'BLOCKED: needs two test account users');
  else
    perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    set local role authenticated;
    insert into public.stubby_capabilities(user_id, profile) values (owner_id,
      '{"version":1,"consent":{"memory":true,"onboarding":false,"feedback":false}}'::jsonb)
      on conflict (user_id) do update set profile = excluded.profile;
    n := (select count(*) from public.stubby_capabilities as c where c.user_id = owner_id);
    results := array_append(results, case when n = 1 then 'PASS: owner read/write' else 'FAIL: owner access' end);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    n := (select count(*) from public.stubby_capabilities as c where c.user_id = owner_id);
    results := array_append(results, case when n = 0 then 'PASS: cross-user read denied' else 'FAIL: isolation' end);
    begin
      insert into public.stubby_capabilities(user_id, profile) values (owner_id, '{"version":1,"consent":{"memory":true,"onboarding":false,"feedback":false}}');
      results := array_append(results, 'FAIL: cross-user write allowed');
    exception when insufficient_privilege then results := array_append(results, 'PASS: cross-user write denied');
      when others then results := array_append(results, 'ERROR: unexpected cross-user SQLSTATE ' || sqlstate);
    end;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    n := (select count(*) from public.stubby_capabilities as c where c.user_id = owner_id);
    results := array_append(results, case when n = 0 then 'PASS: anonymous read denied' else 'FAIL: anonymous access' end);
    begin
      perform public.forget_stubby_memory(owner_id);
      results := array_append(results, 'FAIL: anonymous memory operation');
    exception when insufficient_privilege then results := array_append(results, 'PASS: anonymous operation denied');
      when others then results := array_append(results, 'ERROR: unexpected anonymous SQLSTATE ' || sqlstate);
    end;
    reset role;
    results := array_append(results, case when exists (select 1 from pg_constraint as c where c.conrelid = 'public.stubby_capabilities'::regclass and c.contype = 'f' and c.confdeltype = 'c') then 'PASS: account cascade deletion' else 'FAIL: account cascade' end);
  end if;
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;
rollback;
