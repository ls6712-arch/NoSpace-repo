-- Step 0 · Loop metrics + trimmed events table — verification.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260928150922_step0_loop_metrics.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome. Each write expected to be rejected is its own
-- begin...exception...end sub-block, classifying what's caught
-- (insufficient_privilege = 42501, an RLS block; check_violation = 23514,
-- the `name` CHECK; anything else recorded as 'N ERROR <sqlstate>: <msg>',
-- never silently treated as a pass).
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   MEMBER (non-admin) …e201, ADMIN …e202.
--
-- The metrics.* views aren't asserted against exact computed numbers —
-- they read live profiles/posts/thoughts, which drift — only that each
-- one exists, is queryable without error, and (for the schema itself) is
-- unreachable to anon/authenticated, same as the migration's own intent.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_member uuid := '00000000-0000-4000-8000-00000000e201';
  v_admin  uuid := '00000000-0000-4000-8000-00000000e202';
  v_event_id bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-2. metrics schema: exists, unreachable to anon/authenticated.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  select count(*) into v_n from pg_namespace where nspname = 'metrics';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL schema missing' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_schema_privilege('anon', 'metrics', 'USAGE')
          and not has_schema_privilege('authenticated', 'metrics', 'USAGE')
         then 'PASS' else 'FAIL metrics schema reachable by app roles' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 3-7. Each view exists and is queryable (not asserting computed values —
  -- they read live data). A broken view raises here, which is itself a FAIL.
  -- ───────────────────────────────────────────────────────────────────────
  perform count(*) from metrics.user_cohort;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i)); -- would have raised on failure

  perform count(*) from metrics.first_moment_responses;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  perform count(*) from metrics.moment_noticed;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  perform count(*) from metrics.loop_summary;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  perform count(*) from metrics.noticed_weekly;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- ───────────────────────────────────────────────────────────────────────
  -- 8-9. public.events: RLS on, the two expected policies exist.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'events' and c.relrowsecurity;
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL RLS not enabled' end));

  v_i := v_i + 1;
  select count(*) into v_n from pg_policies
    where schemaname = 'public' and tablename = 'events'
      and policyname in ('events_insert_own_edition_open', 'events_admin_read');
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL saw ' || v_n || ' policies' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 10. name CHECK constraint rejects a value outside the five allowed.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    insert into public.events (name, user_id) values ('bogus_event_name', null);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'events-member@config-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'events-admin@config-test.invalid',  '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set is_admin = false where id = v_member;
  update public.profiles set is_admin = true  where id = v_admin;

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 11. Signed out (anon): any SELECT on events is blocked outright —
  --     table grants were revoked from anon entirely, not just RLS-filtered.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform count(*) from public.events;
    results := array_append(results, format('%s FAIL anon could select', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 12. MEMBER can log their own edition_opened.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  insert into public.events (name, user_id) values ('edition_opened', v_member) returning id into v_event_id;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- 13. MEMBER cannot log a non-edition_opened kind for themselves — RLS
  --     blocks it (every other kind is Edge-Function/service-key only).
  v_i := v_i + 1;
  begin
    insert into public.events (name, user_id) values ('email_opened', v_member);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 14. MEMBER cannot log edition_opened for someone else.
  v_i := v_i + 1;
  begin
    insert into public.events (name, user_id) values ('edition_opened', v_admin);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 15. MEMBER cannot read events (admins only) — not even their own row
  --     just inserted.
  v_i := v_i + 1;
  select count(*) into v_n from public.events where id = v_event_id;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL saw own row' end));

  -- 16. ADMIN can read events, including MEMBER's fixture row.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  v_i := v_i + 1;
  select count(*) into v_n from public.events where id = v_event_id;
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 17. MEMBER cannot UPDATE/DELETE their own row even as the author —
  --     grants only cover insert+select for authenticated.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  v_i := v_i + 1;
  begin
    update public.events set name = 'email_opened' where id = v_event_id;
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
