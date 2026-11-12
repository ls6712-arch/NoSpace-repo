-- Soosh: security hardening (20261120000000_security_hardening.sql).
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
-- Fixed ids (a block no earlier script uses): A …c701 is an admin, B …c702 is a member who is
-- not. Every count is scoped to A's and B's own rows and the app_config keys 'vcheck_audit_c7_*'.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_a uuid := '00000000-0000-4000-8000-00000000c701';
  v_b uuid := '00000000-0000-4000-8000-00000000c702';
begin
  v_owner_role := current_user;

  if to_regclass('private.admin_audit_log') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261120000000_security_hardening.sql first, nothing was created)';
  end if;

  -- 1. Signed-out visitors can't write to any public table.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
            and has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE'));
  results := array_append(results, case when v_n = 0 then format('%s PASS (anon has no write grant on any public table)', v_i)
                                        else format('%s FAIL (anon can still write to %s tables)', v_i, v_n) end);

  -- 2. Nobody in the app can TRUNCATE.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r', 'p')
            and has_table_privilege('authenticated', c.oid, 'TRUNCATE'));
  results := array_append(results, case when v_n = 0 then format('%s PASS (authenticated has no TRUNCATE)', v_i)
                                        else format('%s FAIL (authenticated can TRUNCATE %s tables)', v_i, v_n) end);

  -- 3. The five new rate limits are in place.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_trigger t
          where not t.tgisinternal and t.tgname in ('rl_profile_follows_insert', 'rl_reactions_insert', 'rl_pursuit_discussion_insert',
                                                    'rl_space_join_requests_insert', 'rl_stubby_feedback_insert'));
  results := array_append(results, case when v_n = 5 then format('%s PASS (5 new rate limit triggers)', v_i)
                                        else format('%s FAIL (%s of 5 rate limit triggers)', v_i, v_n) end);

  -- 4. The log and its reader are out of reach for anyone who isn't an admin.
  v_i := v_i + 1;
  results := array_append(results, case
    when not has_function_privilege('anon', 'public.admin_audit_log_recent(integer)', 'EXECUTE')
     and not has_table_privilege('anon', 'private.admin_audit_log', 'SELECT')
     and not has_table_privilege('authenticated', 'private.admin_audit_log', 'SELECT, INSERT, UPDATE, DELETE')
    then format('%s PASS (anon cannot read the log; nobody in the app can touch the table)', v_i)
    else format('%s FAIL (the log or its reader is reachable)', v_i) end);

  -- Fixture, as the table owner, signed out.
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@security-c7.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-b@security-c7.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into public.profile_private (user_id, birthdate) values (v_a, date '1990-01-01'), (v_b, date '1990-01-01')
  on conflict (user_id) do update set birthdate = excluded.birthdate;
  update public.profiles set access = 'active' where public.profiles.id in (v_a, v_b);
  update public.profiles set is_admin = true where public.profiles.id = v_a;

  -- 5. An admin's write to an admin table is logged, with who and what.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  insert into public.app_config (key, value) values ('vcheck_audit_c7_a', '{"v": 1}'::jsonb);
  update public.app_config set value = '{"v": 2}'::jsonb where public.app_config.key = 'vcheck_audit_c7_a';
  v_i := v_i + 1;
  v_n := (select count(*) from private.admin_audit_log l
          where l.admin_id = v_a and l.target_table = 'app_config' and l.target_id = 'vcheck_audit_c7_a');
  results := array_append(results, case when v_n = 2 then format('%s PASS (the admin''s insert and update are both logged)', v_i)
                                        else format('%s FAIL (%s log rows for the admin''s 2 writes)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from private.admin_audit_log l
          where l.admin_id = v_a and l.target_id = 'vcheck_audit_c7_a' and l.action = 'UPDATE'
            and l.before ->> 'value' = '{"v": 1}' and l.after ->> 'value' = '{"v": 2}');
  results := array_append(results, case when v_n = 1 then format('%s PASS (the update keeps the row before and after)', v_i)
                                        else format('%s FAIL (before/after not recorded)', v_i) end);

  -- 6. The same write by someone who isn't an admin is not an admin action.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  insert into public.app_config (key, value) values ('vcheck_audit_c7_b', '{}'::jsonb);
  v_i := v_i + 1;
  v_n := (select count(*) from private.admin_audit_log l where l.target_id = 'vcheck_audit_c7_b');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a non-admin write is not logged)', v_i)
                                        else format('%s FAIL (a non-admin write was logged)', v_i) end);

  -- 7. A non-admin can't read the log.
  v_i := v_i + 1;
  begin
    perform 1 from public.admin_audit_log_recent(10);
    results := array_append(results, format('%s FAIL (a non-admin read the log)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a non-admin is refused with 42501)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (sqlstate %s: %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 8. The admin can, and sees their own entry with their name's column present.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.admin_audit_log_recent(500) r where r.admin_id = v_a and r.target_id = 'vcheck_audit_c7_a');
  results := array_append(results, case when v_n = 2 then format('%s PASS (the admin reads both entries)', v_i)
                                        else format('%s FAIL (the admin read %s of 2 entries)', v_i, v_n) end);

  -- 9. The follow limit: with 60 follows in the last 10 minutes already counted, the next is refused.
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.rate_limit_hits (action, user_id)
  select 'profile_follows_insert', v_a from generate_series(1, 60);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    insert into public.profile_follows (follower_id, followed_id, status) values (v_a, v_b, 'pending');
    results := array_append(results, format('%s FAIL (the 61st follow in 10 minutes went through)', v_i));
  exception
    when sqlstate '55000' then
      results := array_append(results, format('%s PASS (the 61st follow is refused with 55000)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (sqlstate %s: %s)', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
