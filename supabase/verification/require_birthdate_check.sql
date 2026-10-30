-- Open sign-up: no birthdate, no activity.
--
-- Not a migration, nothing here alters the schema permanently. Run this AFTER
-- 20261108000000_require_birthdate.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling; anything
-- unexpected is recorded as 'N ERROR <sqlstate>: <message>'. No select-into, no
-- returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids: A …7101 (a new account), B …7102 (an account that finished onboarding
-- before the rule, no birthdate on file). Every lookup is scoped to those ids.

begin;

do $$
declare
  v_i int := 0;
  v_b boolean;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000007101';
  v_old uuid := '00000000-0000-4000-8000-000000007102';
begin
  if to_regprocedure('private.require_birthdate_to_finish()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261108000000_require_birthdate.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bday.new@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_old, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bday.old@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- B stands for an account made before this rule: finished onboarding, no birthdate.
  -- The trigger is switched off for the one update that sets that up; this is rolled back.
  alter table public.profiles disable trigger profiles_require_birthdate;
  update public.profiles p set onboarding_completed = true where p.id = v_old;
  alter table public.profiles enable trigger profiles_require_birthdate;

  -- 1. A new account is not active.
  v_i := v_i + 1;
  v_b := private.is_active(v_a);
  results := results || (v_i || case when v_b is false then ' PASS new account without a birthdate is not active' else ' FAIL is_active = ' || coalesce(v_b::text, 'null') end);

  -- 2. It can't finish onboarding.
  v_i := v_i + 1;
  begin
    update public.profiles p set onboarding_completed = true where p.id = v_a;
    results := results || (v_i || ' FAIL onboarding finished without a birthdate');
  exception
    when raise_exception then
      results := results || (v_i || case when sqlerrm = 'birthdate_required' then ' PASS cannot finish onboarding without a birthdate' else ' ERROR wrong message: ' || sqlerrm end);
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 3. An under-18 birthdate is refused, so the account stays inactive.
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_a, (current_date - interval '17 years')::date);
    results := results || (v_i || ' FAIL an under-18 birthdate was written');
  exception
    when raise_exception then
      results := results || (v_i || case when sqlerrm = 'under_minimum_age' then ' PASS under-18 birthdate refused' else ' ERROR wrong message: ' || sqlerrm end);
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  results := results || (v_i || case when private.is_active(v_a) is false then ' PASS still not active after the refused birthdate' else ' FAIL became active' end);

  -- 4. A valid birthdate makes it active.
  v_i := v_i + 1;
  insert into public.profile_private (user_id, birthdate) values (v_a, (current_date - interval '25 years')::date);
  results := results || (v_i || case when private.is_active(v_a) is true then ' PASS active once a valid birthdate is on file' else ' FAIL not active' end);

  -- 5. Now it can finish onboarding.
  v_i := v_i + 1;
  begin
    update public.profiles p set onboarding_completed = true where p.id = v_a;
    results := results || (v_i || case when (select p.onboarding_completed from public.profiles p where p.id = v_a) is true then ' PASS finishes onboarding with a birthdate' else ' FAIL not completed' end);
  exception when others then
    results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 6. An account that finished onboarding before the rule keeps working.
  v_i := v_i + 1;
  results := results || (v_i || case when private.is_active(v_old) is true then ' PASS pre-rule account (no birthdate) is still active' else ' FAIL pre-rule account locked out' end);

  -- 7. An unknown account is not active.
  v_i := v_i + 1;
  results := results || (v_i || case when private.is_active('00000000-0000-4000-8000-000000007199') is false then ' PASS unknown account is not active' else ' FAIL unknown account active' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
