-- Hotfix 20261111000000_member_rpc_gate.sql: members-only RPCs, and no skipping the birthday step.
--
-- Not a migration, nothing here changes the schema or the data for good. Run AFTER the migration;
-- run before it, the script stops and says "NOT APPLIED" and creates nothing.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. M ...9701 is a member (onboarding finished), S ...9702 signed up but hasn't finished
-- onboarding (no birthdate), G ...9703 an anonymous user. Every count is scoped to these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ok boolean;
  results text[] := '{}';
  v_m uuid := '00000000-0000-4000-8000-000000009701';
  v_s uuid := '00000000-0000-4000-8000-000000009702';
  v_g uuid := '00000000-0000-4000-8000-000000009703';
  v_owner_role text;
  c record;
begin
  v_owner_role := current_user;
  if to_regprocedure('private.request_gate()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000000_member_rpc_gate.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false, u.anon
  from (values (v_m, 'rg.m@acct-test.invalid', false), (v_s, 'rg.s@acct-test.invalid', false), (v_g, null, true)) as u(id, email, anon);
  -- As the owner: M finished onboarding before this migration.
  update public.profiles set onboarding_completed = true where profiles.id = v_m;

  -- 1. The RPC gate, case by case: who, role, path, allowed?
  for c in
    select * from (values
      (v_s, 'authenticated', '/rpc/create_space', false, 'an unfinished account can''t create a Space'),
      (v_s, 'authenticated', '/rpc/create_event', false, 'an unfinished account can''t create an event'),
      (v_s, 'authenticated', '/rpc/rsvp_to_event', false, 'an unfinished account can''t RSVP'),
      (v_s, 'authenticated', '/rpc/request_or_join_space', false, 'an unfinished account can''t join a Space'),
      (v_s, 'authenticated', '/rpc/send_plan_invite', false, 'an unfinished account can''t send a plan invite'),
      (v_s, 'authenticated', '/rpc/accept_host_invite', false, 'an unfinished account can''t accept a host invite'),
      (v_s, 'authenticated', '/rpc/accept_terms', true, 'onboarding: accept the Terms'),
      (v_s, 'authenticated', '/rpc/set_username_during_onboarding', true, 'onboarding: username'),
      (v_s, 'authenticated', '/rpc/remove_underage_account', true, 'onboarding: the under-18 stop'),
      (v_s, 'authenticated', '/rpc/claim_invite', true, 'an invite link still attaches'),
      (v_s, 'authenticated', '/rpc/finish_onboarding', true, 'onboarding: the last step'),
      (v_s, 'authenticated', '/rpc/get_profile', true, 'public reads stay open'),
      (v_g, 'authenticated', '/rpc/accept_terms', false, 'an anonymous user gets no account RPC'),
      (v_g, 'authenticated', '/rpc/create_space', false, 'an anonymous user can''t create a Space'),
      (v_m, 'authenticated', '/rpc/create_space', true, 'a member can call any RPC'),
      (v_m, 'authenticated', '/rpc/send_plan_invite', true, 'a member is unchanged'),
      (null::uuid, 'anon', '/rpc/create_space', false, 'signed out can''t call a member RPC'),
      (null::uuid, 'anon', '/rpc/get_profile', true, 'signed out can read a public Shelf'),
      (null::uuid, 'anon', '/rpc/invite_preview', true, 'signed out sees an invite'),
      (null::uuid, 'anon', '/rpc/some_future_function', false, 'a new function is closed by default'),
      (v_s, 'authenticated', '/rpc/Create_Space', false, 'the name''s case doesn''t get around it'),
      (v_s, 'authenticated', '/profiles', true, 'table paths are left to RLS'),
      (null::uuid, 'service_role', '/rpc/claim_stubby_ask', true, 'the server role passes')
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

  -- 2. The birthday step can't be skipped.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_s), true);
  v_i := v_i + 1;
  begin
    update public.profiles set onboarding_completed = true where profiles.id = v_s;
    results := results || (v_i || ' FAIL onboarding was skipped with a direct update');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS onboarding can''t be skipped with a direct update');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_ok := public.finish_onboarding();
  v_i := v_i + 1;
  results := results || (v_i || case when v_ok = false then ' PASS finishing needs a birthdate' else ' FAIL finished without a birthdate' end);
  perform set_config('role', v_owner_role, true);

  -- 3. With an 18+ birthdate it finishes, and the account is a member (the gate opens).
  insert into public.profile_private (user_id, birthdate) values (v_s, (current_date - interval '30 years')::date);
  perform set_config('role', 'authenticated', true);
  v_ok := public.finish_onboarding();
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.profiles p where p.id = v_s and p.onboarding_completed);
  v_i := v_i + 1;
  results := results || (v_i || case when v_ok and v_n = 1 then ' PASS with a birthdate onboarding finishes' else ' FAIL finish_onboarding with a birthdate: ' || coalesce(v_ok::text, 'null') end);
  perform set_config('request.path', '/rpc/create_space', true);
  v_i := v_i + 1;
  begin
    perform private.request_gate();
    results := results || (v_i || ' PASS once a member, every RPC is open');
  exception
    when others then results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('request.path', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  -- 4. The catalog.
  v_n := (select count(*) from pg_roles r, unnest(r.rolconfig) s where r.rolname = 'authenticator' and s = 'pgrst.db_pre_request=private.request_gate');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the RPC gate is switched on' else ' FAIL the RPC gate is not set on authenticator' end);

  v_n := (
    select count(*) from pg_proc pp join pg_namespace pn on pn.oid = pp.pronamespace
    where pn.nspname = 'public' and pp.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', pp.oid, 'execute') or has_function_privilege('authenticated', pp.oid, 'execute'))
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS no trigger function is callable as an RPC' else ' FAIL ' || v_n || ' trigger functions are callable' end);

  v_n := (
    select count(*) from private.access_allowlist a
    where a.kind in ('rpc_guest', 'rpc_account')
      and a.name ~ '^(admin_|create_|approve_|ban_|invite_host|send_|join_|request_|accept_host|demote|remove_member|set_space|update_space|rsvp|cancel_|unsend|feature_|confirm_)'
  );
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS no Space, invite or admin RPC is open to non-members' else ' FAIL ' || v_n || ' risky RPCs are on the non-member list' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
