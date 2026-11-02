-- Member gate (20261111000000_member_gate.sql): deny by default for guests and Stubby accounts.
--
-- Not a migration, nothing here changes the schema or the data for good. Run AFTER the migration;
-- run before it, the script stops and says "NOT APPLIED" and creates nothing.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. M ...9501 is a member, S ...9502 a Stubby account (real login, onboarding not
-- finished, no birthdate), G ...9503 a guest (anonymous). Every count is scoped to these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ok boolean;
  results text[] := '{}';
  v_m uuid := '00000000-0000-4000-8000-000000009501';
  v_s uuid := '00000000-0000-4000-8000-000000009502';
  v_g uuid := '00000000-0000-4000-8000-000000009503';
  v_owner_role text;
  c record;
begin
  v_owner_role := current_user;
  if to_regclass('private.access_allowlist') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000000_member_gate.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false, u.anon
  from (values (v_m, 'mg.m@acct-test.invalid', false), (v_s, 'mg.s@acct-test.invalid', false), (v_g, null, true)) as u(id, email, anon);
  update public.profiles set onboarding_completed = true where profiles.id = v_m;

  -- 1. Profiles: one each for M and S, none for the guest.
  v_n := (select count(*) from public.profiles p where p.id in (v_m, v_s));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS real sign-ups get a profile' else ' FAIL ' || v_n || ' of 2 profiles' end);
  v_n := (select count(*) from public.profiles p where p.id = v_g);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a guest gets no profile' else ' FAIL the guest has a profile' end);

  -- 2. A guest who signs up gets a profile marked as from Stubby.
  update auth.users set is_anonymous = false, email = 'mg.g@acct-test.invalid' where users.id = v_g;
  v_n := (select count(*) from public.profiles p where p.id = v_g and p.signed_up_from = 'stubby');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a guest who signs up gets a Stubby profile' else ' FAIL no Stubby profile after sign-up (' || v_n || ')' end);
  -- Back to a guest for the rest (the profile stays, which is what an anonymous user with a
  -- profile would look like; the gate must still treat it as a guest).
  update auth.users set is_anonymous = true where users.id = v_g;

  -- 3. The RPC gate, case by case: who, role, path, allowed?
  for c in
    select * from (values
      (v_g, 'authenticated', '/rpc/create_space', false, 'a guest can''t create a Space'),
      (v_g, 'authenticated', '/rpc/accept_terms', false, 'a guest can''t call an account-only RPC'),
      (v_g, 'authenticated', '/rpc/get_profile', true, 'a guest can read a public Shelf'),
      (v_s, 'authenticated', '/rpc/create_space', false, 'a Stubby account can''t create a Space'),
      (v_s, 'authenticated', '/rpc/rsvp_to_event', false, 'a Stubby account can''t RSVP to a Space event'),
      (v_s, 'authenticated', '/rpc/send_plan_invite', false, 'a Stubby account can''t send a plan invite'),
      (v_s, 'authenticated', '/rpc/accept_terms', true, 'a Stubby account can accept the Terms'),
      (v_s, 'authenticated', '/rpc/finish_onboarding', true, 'a Stubby account can finish onboarding'),
      (v_m, 'authenticated', '/rpc/create_space', true, 'a member can call any RPC'),
      (null::uuid, 'anon', '/rpc/create_space', false, 'signed out can''t call a member RPC'),
      (null::uuid, 'anon', '/rpc/get_profile', true, 'signed out can read a public Shelf'),
      (null::uuid, 'anon', '/rpc/some_future_function', false, 'a new function is closed by default'),
      (v_g, 'authenticated', '/profiles', true, 'table paths are left to RLS'),
      (null::uuid, 'service_role', '/rpc/claim_stubby_turn', true, 'the server role passes')
    ) as t(who, role, path, allowed, label)
  loop
    v_i := v_i + 1;
    perform set_config('request.jwt.claims',
      case when c.who is null then format('{"role":"%s"}', c.role) else format('{"sub":"%s","role":"%s"}', c.who, c.role) end, true);
    perform set_config('request.path', c.path, true);
    begin
      perform private.request_gate();
      results := results || (v_i || case when c.allowed then ' PASS ' else ' FAIL ' end || c.label);
    exception
      when insufficient_privilege then results := results || (v_i || case when c.allowed then ' FAIL ' else ' PASS ' end || c.label);
      when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
    end;
  end loop;
  perform set_config('request.path', '', true);

  -- 4. Tables, as each person.
  perform set_config('role', 'authenticated', true);

  -- The guest: no other profile, no calendar, no members-only table, no profile of its own.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_g), true);
  v_n := (select count(*) from public.profiles p where p.id in (v_m, v_s));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a guest sees no profiles' else ' FAIL a guest sees ' || v_n || ' profiles' end);
  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (user_id, kind, starts_at, ends_at) values (v_g, 'busy', now() + interval '1 day', now() + interval '1 day 1 hour');
    results := results || (v_i || ' FAIL a guest saved a calendar entry');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a guest can''t save to the calendar');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.hobby_follows (user_id, hobby_key) values (v_g, 'mg-check');
    results := results || (v_i || ' FAIL a guest wrote to a members-only table');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a guest can''t write to a members-only table');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_g, date '1990-01-01');
    results := results || (v_i || ' FAIL a guest gave itself a birthdate (and membership)');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a guest can''t give itself a birthdate');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- The Stubby account: its own profile and calendar, its own one-off plan, nothing else.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_s), true);
  v_n := (select count(*) from public.profiles p where p.id = v_s);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a Stubby account sees its own profile' else ' FAIL own profile not visible (' || v_n || ')' end);
  v_n := (select count(*) from public.profiles p where p.id = v_m);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a Stubby account sees no member profiles' else ' FAIL a Stubby account sees a member profile' end);
  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (user_id, kind, starts_at, ends_at) values (v_s, 'busy', now() + interval '1 day', now() + interval '1 day 1 hour');
    results := results || (v_i || ' PASS a Stubby account saves to its own calendar');
  exception
    when others then results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, is_plan, shared) values ('mg_plan_s', v_s, 'MG plan', true, false);
    insert into public.pursuit_sessions (pursuit_id, starts_at, note, created_by) values ('mg_plan_s', now() + interval '2 days', 'MG plan', v_s);
    results := results || (v_i || ' PASS a Stubby account makes its own one-off plan');
  exception
    when others then results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, is_plan, shared) values ('mg_pursuit_s', v_s, 'MG pursuit', false, false);
    results := results || (v_i || ' FAIL a Stubby account started a Pursuit');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a Stubby account can''t start a Pursuit');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, is_plan, shared) values ('mg_shared_s', v_s, 'MG shared', true, true);
    results := results || (v_i || ' FAIL a Stubby account shared a plan');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a Stubby account can''t share a plan');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.hobby_follows (user_id, hobby_key) values (v_s, 'mg-check');
    results := results || (v_i || ' FAIL a Stubby account wrote to a members-only table');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a Stubby account can''t write to a members-only table');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    update public.profiles set onboarding_completed = true where profiles.id = v_s;
    results := results || (v_i || ' FAIL a Stubby account skipped onboarding with an update');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS onboarding can''t be skipped with an update');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_ok := public.finish_onboarding();
  v_i := v_i + 1;
  results := results || (v_i || case when v_ok = false then ' PASS finishing onboarding needs a birthdate' else ' FAIL onboarding finished without a birthdate' end);

  -- The member: unchanged.
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_m), true);
  v_n := (select count(*) from public.profiles p where p.id in (v_m, v_s));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS a member sees profiles as before' else ' FAIL a member sees ' || v_n || ' of 2 profiles' end);
  v_i := v_i + 1;
  begin
    insert into public.hobby_follows (user_id, hobby_key) values (v_m, 'mg-check');
    results := results || (v_i || ' PASS a member writes as before');
  exception
    when others then results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  -- 5. The catalog: nothing reachable without being on the list.
  v_n := (
    select count(*) from pg_tables pt
    where pt.schemaname = 'public'
      and not exists (select 1 from pg_policies pp where pp.schemaname = 'public' and pp.tablename = pt.tablename and pp.permissive = 'RESTRICTIVE' and pp.policyname = 'members only')
      and not exists (select 1 from private.access_allowlist a where a.kind = 'table_nonmember' and a.name = pt.tablename)
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every table is members only or on the list' else ' FAIL ' || v_n || ' tables are neither' end);

  v_n := (
    select count(distinct pp.tablename) from pg_policies pp
    where pp.schemaname = 'public'
      and (pp.roles && array['anon', 'public']::name[])
      and not exists (select 1 from private.access_allowlist a where a.kind = 'table_anon' and a.name = pp.tablename)
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every table with a signed-out policy is on the list' else ' FAIL ' || v_n || ' tables have an unlisted signed-out policy' end);

  v_n := (select count(*) from pg_tables pt where pt.schemaname = 'public' and not pt.rowsecurity);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS RLS is on for every table' else ' FAIL ' || v_n || ' tables without RLS' end);

  v_n := (
    select count(*) from pg_class pc join pg_namespace pn on pn.oid = pc.relnamespace
    where pn.nspname = 'public' and pc.relkind in ('v', 'm')
      and not coalesce(pc.reloptions @> array['security_invoker=true'], false)
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every view uses security_invoker' else ' FAIL ' || v_n || ' views run as their owner' end);

  v_n := (
    select count(*) from pg_proc pp join pg_namespace pn on pn.oid = pp.pronamespace
    where pn.nspname = 'public' and pp.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', pp.oid, 'execute') or has_function_privilege('authenticated', pp.oid, 'execute'))
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS no trigger function is callable as an RPC' else ' FAIL ' || v_n || ' trigger functions are callable' end);

  v_n := (select count(*) from pg_roles r, unnest(r.rolconfig) s where r.rolname = 'authenticator' and s = 'pgrst.db_pre_request=private.request_gate');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the RPC gate is switched on' else ' FAIL the RPC gate is not set on authenticator' end);

  v_n := (
    select count(*) from pg_policies pp
    where pp.policyname = 'members only' and pp.permissive = 'RESTRICTIVE'
      and ((pp.schemaname = 'storage' and pp.tablename = 'objects') or (pp.schemaname = 'realtime' and pp.tablename = 'messages'))
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS Storage and Realtime are members only' else ' FAIL ' || v_n || ' of 2 Storage and Realtime policies' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
