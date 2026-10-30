-- Soosh onboarding PR 2: open sign-up and the account (member_no, birthdate,
-- area, onboarding_step, usernames, handle_new_user).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261103000000_open_signup_and_account.sql. Run before it, the script stops at
-- the first check and says so ("NOT APPLIED"); it never creates anything then.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results land
-- in the error message the Editor shows and a rollback is guaranteed whatever
-- happens. Each expected failure is its own begin...exception...end sub-block
-- with strict sqlstate handling; anything unexpected is recorded as
-- 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids: A …5101, B …5102 (same email prefix on different domains, so the
-- second one proves the username collision handling), C …5103 (a very short
-- prefix). Every count and lookup is scoped to those ids, never to a whole live
-- table; whole-table facts (a column being NOT NULL, an index existing) are read
-- from the catalog instead.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000005101';
  v_b uuid := '00000000-0000-4000-8000-000000005102';
  v_c uuid := '00000000-0000-4000-8000-000000005103';
  v_ma int;
  v_mb int;
begin
  v_owner_role := current_user;

  if to_regprocedure('public.set_username_during_onboarding(text)') is null
     or to_regprocedure('public.my_member_no()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261103000000_open_signup_and_account.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (table-owner) role, bypasses RLS. The profile
  -- rows come from the on_auth_user_created trigger (handle_new_user).
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctcheck.mia@one.acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctcheck.mia@two.acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@three.acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_a, v_b, v_c));
  results := array_append(results, case when v_n = 3 then format('%s PASS (profiles created for the 3 fixture users)', v_i)
                                        else format('%s FAIL (expected 3 profiles, got %s)', v_i, v_n) end);

  -- Open sign-up: a new account is active with no invite.
  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_a, v_b, v_c) and p.access = 'active');
  results := array_append(results, case when v_n = 3 then format('%s PASS (new accounts are active)', v_i)
                                        else format('%s FAIL (only %s of 3 active)', v_i, v_n) end);

  -- Member numbers: assigned, distinct, in creation order.
  v_ma := (select p.member_no from public.profiles p where p.id = v_a);
  v_mb := (select p.member_no from public.profiles p where p.id = v_b);
  v_i := v_i + 1;
  results := array_append(results, case when v_ma is not null and v_mb is not null and v_mb > v_ma
                                        then format('%s PASS (member numbers %s then %s)', v_i, v_ma, v_mb)
                                        else format('%s FAIL (A %s, B %s)', v_i, v_ma, v_mb) end);

  -- Usernames: the same email prefix on two domains gets two usernames.
  v_i := v_i + 1;
  v_n := (select count(distinct lower(p.username)) from public.profiles p where p.id in (v_a, v_b));
  results := array_append(results, case when v_n = 2 then format('%s PASS (the same prefix got 2 different usernames)', v_i)
                                        else format('%s FAIL (usernames collided)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_a, v_b, v_c) and p.username ~ '^[a-z0-9_]{3,20}$');
  results := array_append(results, case when v_n = 3 then format('%s PASS (all 3 usernames are 3 to 20 lowercase letters, numbers or _)', v_i)
                                        else format('%s FAIL (only %s of 3 usernames are well formed)', v_i, v_n) end);

  -- The member number cannot be changed, even by the table owner.
  v_i := v_i + 1;
  begin
    update public.profiles p set member_no = p.member_no + 100000 where p.id = v_a;
    results := array_append(results, format('%s FAIL (member_no changed)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (member_no is locked)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Catalog facts about the whole table, read without counting live rows.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_attribute a
          where a.attrelid = 'public.profiles'::regclass and a.attname = 'member_no' and a.attnotnull);
  results := array_append(results, case when v_n = 1 then format('%s PASS (member_no is NOT NULL)', v_i)
                                        else format('%s FAIL (member_no is nullable)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c where c.conrelid = 'public.profiles'::regclass and c.conname = 'profiles_member_no_key' and c.contype = 'u');
  results := array_append(results, case when v_n = 1 then format('%s PASS (member_no is unique)', v_i)
                                        else format('%s FAIL (no unique constraint on member_no)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_indexes i where i.schemaname = 'public' and i.indexname = 'profiles_username_lower_key' and i.indexdef ilike '%lower(username)%');
  results := array_append(results, case when v_n = 1 then format('%s PASS (usernames are unique ignoring case)', v_i)
                                        else format('%s FAIL (no lower(username) unique index)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c where c.conrelid = 'public.profile_private'::regclass and c.contype = 'f' and c.confdeltype = 'c');
  results := array_append(results, case when v_n >= 1 then format('%s PASS (profile_private rows cascade with the account)', v_i)
                                        else format('%s FAIL (no cascade on profile_private)', v_i) end);

  v_i := v_i + 1;
  results := array_append(results, case when not has_sequence_privilege('authenticated', 'public.profiles_member_no_seq', 'usage')
                                        then format('%s PASS (clients cannot touch the member number sequence)', v_i)
                                        else format('%s FAIL (authenticated can use the sequence)', v_i) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- As signed-in person A.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  v_n := public.my_member_no();
  results := array_append(results, case when v_n = v_ma then format('%s PASS (my_member_no returns A''s own number)', v_i)
                                        else format('%s FAIL (my_member_no gave %s, expected %s)', v_i, v_n, v_ma) end);

  v_i := v_i + 1;
  begin
    update public.profiles p set member_no = 999999 where p.id = v_a;
    results := array_append(results, format('%s FAIL (a client changed member_no)', v_i));
  exception
    when insufficient_privilege or raise_exception then
      results := array_append(results, format('%s PASS (a client cannot write member_no)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Birthdate: under 18 is refused, exactly 18 is accepted, nonsense is refused.
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_a, (current_date - interval '17 years 364 days')::date);
    results := array_append(results, format('%s FAIL (a 17 year old birthdate was saved)', v_i));
  exception
    when raise_exception then
      if sqlerrm = 'under_minimum_age' then
        results := array_append(results, format('%s PASS (under 18 refused)', v_i));
      else
        results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
      end if;
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_a, (current_date + 1));
    results := array_append(results, format('%s FAIL (a future birthdate was saved)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (a future date refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate) values (v_a, date '1899-12-31');
    results := array_append(results, format('%s FAIL (a 1899 birthdate was saved)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (before 1900 refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, birthdate, city, area, onboarding_step)
    values (v_a, (current_date - interval '18 years')::date, 'New York', 'Williamsburg', 'birthday');
    v_n := (select count(*) from public.profile_private pp where pp.user_id = v_a and pp.area = 'Williamsburg' and pp.onboarding_step = 'birthday');
    results := array_append(results, case when v_n = 1 then format('%s PASS (exactly 18 accepted, with area and step)', v_i)
                                          else format('%s FAIL (row not saved as expected)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set onboarding_step = 'nope' where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (an unknown step was saved)', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS (unknown step refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set area = repeat('x', 81) where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (an 81 character area was saved)', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS (area over 80 characters refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Usernames.
  v_i := v_i + 1;
  v_text := public.set_username_during_onboarding('Acct_Check_Mia');
  v_n := (select count(*) from public.profiles p where p.id = v_a and p.username = 'acct_check_mia');
  results := array_append(results, case when v_text = 'ok' and v_n = 1 then format('%s PASS (username saved lowercase)', v_i)
                                        else format('%s FAIL (got %s, stored %s)', v_i, v_text, v_n) end);

  v_i := v_i + 1;
  v_text := public.set_username_during_onboarding('ab');
  results := array_append(results, case when v_text = 'invalid' then format('%s PASS (2 characters is invalid)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  v_i := v_i + 1;
  v_text := public.set_username_during_onboarding('has space');
  results := array_append(results, case when v_text = 'invalid' then format('%s PASS (a space is invalid)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  v_i := v_i + 1;
  v_text := public.set_username_during_onboarding('admin');
  results := array_append(results, case when v_text = 'taken' then format('%s PASS (a reserved name is not free)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  -- Someone else's row is invisible.
  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_private pp where pp.user_id in (v_a, v_b));
  results := array_append(results, case when v_n = 1 then format('%s PASS (A reads only their own private row)', v_i)
                                        else format('%s FAIL (A sees %s rows)', v_i, v_n) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- As signed-in person B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_private pp where pp.user_id in (v_a, v_b));
  results := array_append(results, case when v_n = 0 then format('%s PASS (B cannot read A''s private row)', v_i)
                                        else format('%s FAIL (B sees %s rows)', v_i, v_n) end);

  v_i := v_i + 1;
  v_text := public.set_username_during_onboarding('acct_check_mia');
  results := array_append(results, case when v_text = 'taken' then format('%s PASS (A''s username is taken for B)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  v_i := v_i + 1;
  v_text := public.username_suggestion('acct_check_mia');
  results := array_append(results, case when v_text = 'acct_check_mia_ny' then format('%s PASS (suggests acct_check_mia_ny)', v_i)
                                        else format('%s FAIL (suggested %s)', v_i, v_text) end);

  v_i := v_i + 1;
  v_text := public.username_suggestion('zz_acct_check_free');
  results := array_append(results, case when v_text = 'zz_acct_check_free' then format('%s PASS (a free name is suggested as it is)', v_i)
                                        else format('%s FAIL (suggested %s)', v_i, v_text) end);

  -- A signed-out visitor cannot call either function.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform public.username_suggestion('anything');
    results := array_append(results, format('%s FAIL (anon ran username_suggestion)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (anon refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- After onboarding the username is read-only.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  update public.profiles p set onboarding_completed = true where p.id = v_a;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    v_text := public.set_username_during_onboarding('acct_check_new');
    results := array_append(results, format('%s FAIL (username changed after onboarding: %s)', v_i, v_text));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (username locked after onboarding)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
