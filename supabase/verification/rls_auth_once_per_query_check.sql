-- Policies ask who is signed in once per query: 20261130000000_rls_auth_once_per_query.sql.
--
-- Not a migration. Run AFTER 20261130000000_rls_auth_once_per_query.sql; before it, cases 1 and 2 fail.
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'.
-- No select-into, no returning-into, no delete (CLAUDE.md). Cases 1 to 3 only read the catalog.
-- Cases 4 to 7 use two fixture users (…9411, …9412) and one Moment whose caption starts with 'RAO ';
-- every lookup is scoped to them.
--
-- Cases:
--   1  no policy in public calls auth.uid(), auth.role(), auth.jwt() or auth.email() bare
--   2  none on storage does either (a FAIL here alone means the storage ones were skipped: not the owner)
--   3  the rewrite kept every policy: none in public or storage lost both its USING and its WITH CHECK
--   4  a signed-in person can still edit their own profile
--   5  and still cannot edit someone else's
--   6  the owner still reads their own Only you Moment
--   7  someone else still does not

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009411';
  v_b uuid := '00000000-0000-4000-8000-000000009412';
  v_u uuid;
begin
  v_owner_role := current_user;

  v_n := (select count(*) from pg_catalog.pg_policy pol
            join pg_catalog.pg_class c on c.oid = pol.polrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and (coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
                 ~ '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS no bare auth call in a public policy' else ' FAIL ' || v_n || ' public policies still call auth bare' end);

  v_n := (select count(*) from pg_catalog.pg_policy pol
            join pg_catalog.pg_class c on c.oid = pol.polrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'storage'
             and (coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
                 ~ '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS no bare auth call in a storage policy' else ' FAIL ' || v_n || ' storage policies still call auth bare' end);

  v_n := (select count(*) from pg_catalog.pg_policy pol
            join pg_catalog.pg_class c on c.oid = pol.polrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('public', 'storage') and pol.polqual is null and pol.polwithcheck is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every policy still has its rule' else ' FAIL ' || v_n || ' policies have no rule' end);

  -- Fixtures for 4 to 7.
  begin
    foreach v_u in array array[v_a, v_b] loop
      insert into auth.users
        (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
      values
        (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'rao.check.' || right(v_u::text, 4) || '@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
      insert into public.profile_private (user_id, birthdate) values (v_u, (current_date - interval '25 years')::date);
    end loop;
    perform set_config('request.jwt.claim.sub', v_a::text, true);
    perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_a), true);
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
    values (v_a, 'sports-fitness', 'written', '', 'RAO only you', 'just_me', now());
  exception when others then
    results := results || ('0 ERROR fixtures ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_a), true);

  v_i := v_i + 1;
  begin
    update public.profiles p set bio = 'RAO check' where p.id = v_a;
    get diagnostics v_n = row_count;
    results := results || (v_i || case when v_n = 1 then ' PASS you can edit your own profile' else ' FAIL own profile rows: ' || v_n end);
  exception when others then
    results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    update public.profiles p set bio = 'RAO check' where p.id = v_b;
    get diagnostics v_n = row_count;
    results := results || (v_i || case when v_n = 0 then ' PASS you cannot edit someone else''s profile' else ' FAIL other profile rows: ' || v_n end);
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS you cannot edit someone else''s profile (refused)');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.posts po where po.user_id = v_a and po.caption = 'RAO only you');
    results := results || (v_i || case when v_n = 1 then ' PASS the owner reads their Only you Moment' else ' FAIL owner sees ' || v_n end);
  exception when others then
    results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As B.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_b), true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.posts po where po.user_id = v_a and po.caption = 'RAO only you');
    results := results || (v_i || case when v_n = 0 then ' PASS someone else does not' else ' FAIL someone else sees ' || v_n end);
  exception when others then
    results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
