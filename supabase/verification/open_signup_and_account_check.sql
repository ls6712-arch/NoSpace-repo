-- Soosh onboarding PR 2: open sign-up and the account (member_no, birthdate,
-- area, onboarding_step, usernames, handle_new_user).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261104000000_open_signup_and_account.sql. Run before it, the script stops at
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
-- prefix; later the under-18 removal), D …5104 (an inviter), E …5105 (active,
-- no inviter, claims an invite), F …5106 (active, stale and self invites),
-- G …5107 (pending, claims), H …5108 (pending, bad code).
-- Invite codes: ACCTCHK1 to ACCTCHK5. Every count and lookup is scoped to those ids, never to a whole live
-- table; whole-table facts (a column being NOT NULL, an index existing) are read
-- from the catalog instead. The nightly purge is run inside the transaction to prove
-- C is erased; it is rolled back with everything else.

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
  v_d uuid := '00000000-0000-4000-8000-000000005104';
  v_e uuid := '00000000-0000-4000-8000-000000005105';
  v_f uuid := '00000000-0000-4000-8000-000000005106';
  v_g uuid := '00000000-0000-4000-8000-000000005107';
  v_h uuid := '00000000-0000-4000-8000-000000005108';
  v_uuid uuid;
  v_ts timestamptz;
  v_ma int;
  v_mb int;
begin
  v_owner_role := current_user;

  if to_regprocedure('public.purge_deleted_accounts()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261103000000_account_deletion_purge.sql first, nothing was created)';
  end if;

  if to_regprocedure('public.set_username_during_onboarding(text)') is null
     or to_regprocedure('public.my_member_no()') is null
     or to_regprocedure('public.remove_underage_account()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261104000000_open_signup_and_account.sql first, nothing was created)';
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

  -- Accounts made after the migration with no password are not marked as having one.
  v_i := v_i + 1;
  v_n := (select count(*) from auth.users u where u.id in (v_a, v_b, v_c) and coalesce(u.raw_user_meta_data ->> 'has_password', '') = 'true');
  results := array_append(results, case when v_n = 0 then format('%s PASS (new code accounts are not marked as having a password)', v_i)
                                        else format('%s FAIL (%s fixture accounts marked)', v_i, v_n) end);

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

  -- ───────────────────────────────────────────────────────────────────────
  -- Invites: claiming as an already-active person still attaches the inviter.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctinv.d@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctinv.e@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctinv.f@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_g, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctinv.g@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_h, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acctinv.h@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles p set access = 'pending' where p.id in (v_g, v_h);
  update public.profiles p set invite_allowance = 5 where p.id = v_e;
  insert into public.invites (code, inviter_id) values ('ACCTCHK1', v_d), ('ACCTCHK2', v_d), ('ACCTCHK5', v_d), ('ACCTCHK3', v_f);
  insert into public.invites (code, inviter_id, expires_at) values ('ACCTCHK4', v_d, now() - interval '1 day');

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_d, v_e, v_f, v_g, v_h));
  results := array_append(results, case when v_n = 5 then format('%s PASS (5 invite fixture profiles; E, F active and G, H pending)', v_i)
                                        else format('%s FAIL (expected 5 profiles, got %s)', v_i, v_n) end);

  -- E: active, no inviter, claims a valid invite.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_e), true);
  v_i := v_i + 1;
  v_text := public.claim_invite('acctchk1');
  results := array_append(results, case when v_text = 'claimed' then format('%s PASS (an active person claims an invite)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_uuid := (select p.invited_by from public.profiles p where p.id = v_e);
  results := array_append(results, case when v_uuid = v_d then format('%s PASS (invited_by is the inviter)', v_i)
                                        else format('%s FAIL (invited_by %s)', v_i, v_uuid) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_follows f
          where f.status = 'accepted'
            and ((f.follower_id = v_e and f.followed_id = v_d) or (f.follower_id = v_d and f.followed_id = v_e)));
  results := array_append(results, case when v_n = 2 then format('%s PASS (two-way follow created)', v_i)
                                        else format('%s FAIL (%s follow rows)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.invites i where i.code = 'ACCTCHK1' and i.status = 'claimed' and i.claimed_by = v_e);
  results := array_append(results, case when v_n = 1 then format('%s PASS (the invite is marked claimed by E)', v_i)
                                        else format('%s FAIL (invite not claimed by E)', v_i) end);

  v_i := v_i + 1;
  v_n := (select p.invite_allowance from public.profiles p where p.id = v_e);
  results := array_append(results, case when v_n >= 5 then format('%s PASS (E''s invite allowance was not lowered)', v_i)
                                        else format('%s FAIL (allowance %s)', v_i, v_n) end);

  -- E already has an inviter: a second invite is not consumed.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_e), true);
  v_i := v_i + 1;
  v_text := public.claim_invite('ACCTCHK2');
  results := array_append(results, case when v_text = 'already_active' then format('%s PASS (a second invite answers already_active)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.invites i where i.code = 'ACCTCHK2' and i.status = 'open');
  results := array_append(results, case when v_n = 1 then format('%s PASS (the second invite is still open)', v_i)
                                        else format('%s FAIL (second invite was used)', v_i) end);

  -- F: active. A made-up code, their own invite and an expired one change nothing.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_i := v_i + 1;
  v_text := public.claim_invite('NOPE-NOPE');
  results := array_append(results, case when v_text = 'already_active' then format('%s PASS (an unknown code tells an active person nothing is wrong)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);
  v_i := v_i + 1;
  v_text := public.claim_invite('ACCTCHK3');
  results := array_append(results, case when v_text = 'already_active' then format('%s PASS (your own invite is not claimable)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);
  v_i := v_i + 1;
  v_text := public.claim_invite('ACCTCHK4');
  results := array_append(results, case when v_text = 'already_active' then format('%s PASS (an expired invite is not claimable)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id = v_f and p.invited_by is null);
  results := array_append(results, case when v_n = 1 then format('%s PASS (F still has no inviter)', v_i)
                                        else format('%s FAIL (F got an inviter)', v_i) end);
  v_i := v_i + 1;
  v_n := (select count(*) from public.invites i where i.code in ('ACCTCHK3', 'ACCTCHK4') and i.status = 'open');
  results := array_append(results, case when v_n = 2 then format('%s PASS (the self and expired invites stay open)', v_i)
                                        else format('%s FAIL (%s still open)', v_i, v_n) end);

  -- G: pending, claims: becomes active with the inviter, as before.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_g), true);
  v_i := v_i + 1;
  v_text := public.claim_invite('ACCTCHK5');
  results := array_append(results, case when v_text = 'claimed' then format('%s PASS (a pending person claims and is activated)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id = v_g and p.access = 'active' and p.invited_by = v_d);
  results := array_append(results, case when v_n = 1 then format('%s PASS (G is active with D as inviter)', v_i)
                                        else format('%s FAIL (G not activated)', v_i) end);

  -- H: pending with a bad code is still told it is invalid.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_h), true);
  v_i := v_i + 1;
  v_text := public.claim_invite('NOPE-NOPE');
  results := array_append(results, case when v_text = 'invalid' then format('%s PASS (a pending person with a bad code gets invalid)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  -- Signed out cannot claim.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_text := public.claim_invite('ACCTCHK1');
    results := array_append(results, format('%s FAIL (anon claimed: %s)', v_i, v_text));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (anon refused)', v_i));
    when sqlstate '28000' then
      results := array_append(results, format('%s PASS (anon told to sign in)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Under-18 removal: due for the next purge, and it cannot be cancelled.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  v_text := public.remove_underage_account()::text;
  results := array_append(results, case when v_text = 'false' then format('%s PASS (an account that finished onboarding is not removed)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  v_text := public.remove_underage_account()::text;
  results := array_append(results, case when v_text = 'true' then format('%s PASS (C, mid-onboarding, is removed)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  perform set_config('role', v_owner_role, true);
  v_ts := (select p.deletion_requested_at from public.profiles p where p.id = v_c);
  v_i := v_i + 1;
  results := array_append(results, case when v_ts is not null and v_ts <= now() - interval '14 days' then format('%s PASS (C is already past the 14 days, so the next purge takes it)', v_i)
                                        else format('%s FAIL (deletion_requested_at %s)', v_i, v_ts) end);
  v_i := v_i + 1;
  v_ts := (select p.deletion_requested_at from public.profiles p where p.id = v_a);
  results := array_append(results, case when v_ts is null then format('%s PASS (A was left alone)', v_i)
                                        else format('%s FAIL (A got a deletion date)', v_i) end);

  -- C cannot cancel it.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    update public.profiles p set deletion_requested_at = null where p.id = v_c;
    results := array_append(results, format('%s FAIL (C cancelled the removal)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (a removal past its 14 days cannot be cancelled)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Someone inside the 14 days (asked to delete today) can still keep their account.
  perform set_config('role', v_owner_role, true);
  update public.profiles p set deletion_requested_at = now() where p.id = v_f;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_i := v_i + 1;
  begin
    update public.profiles p set deletion_requested_at = null where p.id = v_f;
    v_n := (select count(*) from public.profiles p where p.id = v_f and p.deletion_requested_at is null);
    results := array_append(results, case when v_n = 1 then format('%s PASS (inside the 14 days, Keep my account still works)', v_i)
                                          else format('%s FAIL (not cleared)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- The nightly purge takes C and only C of the fixture (rolled back with everything else).
  perform set_config('role', v_owner_role, true);
  perform public.purge_deleted_accounts();
  v_i := v_i + 1;
  v_n := (select count(*) from auth.users u where u.id = v_c);
  results := array_append(results, case when v_n = 0 then format('%s PASS (the purge erased C)', v_i)
                                        else format('%s FAIL (C is still there)', v_i) end);
  v_i := v_i + 1;
  v_n := (select count(*) from auth.users u where u.id in (v_a, v_b, v_d, v_e, v_f, v_g, v_h));
  results := array_append(results, case when v_n = 7 then format('%s PASS (the other 7 fixture accounts are untouched)', v_i)
                                        else format('%s FAIL (%s of 7 left)', v_i, v_n) end);

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
