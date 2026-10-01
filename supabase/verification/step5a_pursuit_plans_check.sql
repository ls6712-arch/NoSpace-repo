-- Step 5a · pursuit_plans + let_go_at — verification.
--
-- Not a migration. Run AFTER 20261014000000_step5a_pursuit_plans_and_let_go.sql.
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO
-- (see CLAUDE.md); every value is assigned with :=.
--
-- Fixed ids: OWNER …7401, MEMBER …7402, STRANGER …7403, PENDING …7404.
-- The fixture Pursuit is shared (readable by anyone), which is exactly the
-- case where a plan must still stay private.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_pid text := 'step5a-check-pursuit';
  v_owner uuid := '00000000-0000-4000-8000-000000007401';
  v_member uuid := '00000000-0000-4000-8000-000000007402';
  v_stranger uuid := '00000000-0000-4000-8000-000000007403';
  v_pending uuid := '00000000-0000-4000-8000-000000007404';
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step5a-owner@step5a-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step5a-member@step5a-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step5a-stranger@step5a-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_pending, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'step5a-pending@step5a-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set access = 'active'
    where public.profiles.id in (v_owner, v_member, v_stranger);

  insert into public.pursuits (id, user_id, title, shared)
  values (v_pid, v_owner, 'Step 5a check (rolled back)', true);
  insert into public.pursuit_members (pursuit_id, user_id, role, status, invited_by) values
    (v_pid, v_owner, 'owner', 'joined', v_owner),
    (v_pid, v_member, 'member', 'joined', v_owner),
    (v_pid, v_pending, 'member', 'joined', v_owner);

  perform set_config('role', 'authenticated', true);

  -- 1. Owner saves their plan.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  begin
    insert into public.pursuit_plans (pursuit_id, user_id, next_session_at, next_session_note, times_per_week)
    values (v_pid, v_owner, now() + interval '2 days', 'Glaze the bowls', 3);
    results := array_append(results, format('%s PASS', v_i));
  exception when others then
    results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 2. Owner reads it back.
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_plans
    where public.pursuit_plans.pursuit_id = v_pid and public.pursuit_plans.user_id = v_owner);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 3. A stranger can read the shared Pursuit…
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuits where public.pursuits.id = v_pid);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL pursuit_rows=' || v_n end));

  -- 4. …but not the owner's plan.
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_plans where public.pursuit_plans.pursuit_id = v_pid);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL leaked=' || v_n end));

  -- 5. A stranger can't add a plan to someone else's Pursuit (RLS 42501).
  v_i := v_i + 1;
  begin
    insert into public.pursuit_plans (pursuit_id, user_id, times_per_week) values (v_pid, v_stranger, 2);
    results := array_append(results, format('%s FAIL stranger planned', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 6. A member can't read the owner's plan.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_plans where public.pursuit_plans.pursuit_id = v_pid);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL leaked=' || v_n end));

  -- 7. A member keeps their own plan on the same Pursuit.
  v_i := v_i + 1;
  begin
    insert into public.pursuit_plans (pursuit_id, user_id, times_per_week) values (v_pid, v_member, 2);
    results := array_append(results, format('%s PASS', v_i));
  exception when others then
    results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 8. Nobody can write a plan as someone else (RLS 42501).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  begin
    insert into public.pursuit_plans (pursuit_id, user_id, times_per_week) values (v_pid, v_stranger, 2);
    results := array_append(results, format('%s FAIL wrote as someone else', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 9. Times a week must be 1–14 (check 23514).
  v_i := v_i + 1;
  begin
    update public.pursuit_plans set times_per_week = 0
      where public.pursuit_plans.pursuit_id = v_pid and public.pursuit_plans.user_id = v_owner;
    results := array_append(results, format('%s FAIL accepted 0', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 10. Note is capped at 140 characters (check 23514).
  v_i := v_i + 1;
  begin
    update public.pursuit_plans set next_session_note = repeat('x', 141)
      where public.pursuit_plans.pursuit_id = v_pid and public.pursuit_plans.user_id = v_owner;
    results := array_append(results, format('%s FAIL accepted 141 chars', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 11. A pending account can't plan, even as a member (RLS 42501).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_pending), true);
  v_i := v_i + 1;
  begin
    insert into public.pursuit_plans (pursuit_id, user_id, times_per_week) values (v_pid, v_pending, 2);
    results := array_append(results, format('%s FAIL pending planned', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 12. Owner can mark the Pursuit Let go.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  update public.pursuits set let_go_at = now() where public.pursuits.id = v_pid;
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuits
    where public.pursuits.id = v_pid and public.pursuits.let_go_at is not null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 13. Deleting the Pursuit removes its plans (cascade).
  perform set_config('role', v_owner_role, true);
  delete from public.pursuits where public.pursuits.id = v_pid;
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_plans where public.pursuit_plans.pursuit_id = v_pid);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL orphans=' || v_n end));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
