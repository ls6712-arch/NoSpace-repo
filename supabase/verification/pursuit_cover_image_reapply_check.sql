-- Sushii: Pursuit cover image, applied by
-- 20261015000000_pursuit_cover_image_reapply.sql — verification.
--
-- Not a migration — nothing here alters the schema (the inserts are fixture
-- data, rolled back unconditionally at the end). Run this AFTER
-- 20261015000000_pursuit_cover_image_reapply.sql. It replaces the script that
-- went with the 20261011000000 cover migration, which never ran.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   OWNER …7001 — MEMBER …7002 — STRANGER …7003
--   Pursuit "pcover-priv" (not shared, MEMBER joined)
--   Pursuit "pcover-pub"  (shared = true)
-- Every count and lookup below is scoped to those ids or to the fixture's own
-- storage object names, never to the whole table.

begin;

do $$
declare
  v_i int := 0;
  v_owner uuid := '00000000-0000-4000-8000-000000007001';
  v_member uuid := '00000000-0000-4000-8000-000000007002';
  v_stranger uuid := '00000000-0000-4000-8000-000000007003';
  v_obj_priv text;
  v_obj_pub text;
  v_n int;
  v_bool boolean;
  v_text text;
  v_sqlstate text;
  v_constraint text;
  results text[] := '{}';
begin
  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcover-owner@phase-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcover-member@phase-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcover-stranger@phase-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.pursuits (id, user_id, title, shared)
  values
    ('pcover-priv', v_owner, 'Private test pursuit', false),
    ('pcover-pub', v_owner, 'Shared test pursuit', true);

  insert into public.pursuit_members (pursuit_id, user_id, role, status)
  values ('pcover-priv', v_member, 'member', 'joined');

  v_obj_priv := v_owner::text || '/' || gen_random_uuid()::text || '.jpg';
  v_obj_pub := v_owner::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into storage.objects (bucket_id, name, owner, owner_id) values
    ('moment-media', v_obj_priv, v_owner, v_owner::text),
    ('moment-media', v_obj_pub, v_owner, v_owner::text);

  update public.pursuits set cover_image_path = v_obj_priv where pursuits.id = 'pcover-priv';
  update public.pursuits set cover_image_path = v_obj_pub where pursuits.id = 'pcover-pub';

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. Both columns exist on pursuits, with the right types.
  -- ───────────────────────────────────────────────────────────────────────
  v_n := (select count(*) from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = 'pursuits'
            and ((c.column_name = 'cover_image_path' and c.data_type = 'text' and c.is_nullable = 'YES')
              or (c.column_name = 'cover_image_preference' and c.data_type = 'text' and c.is_nullable = 'NO')));
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL expected 2 columns, found ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 2. A new Pursuit gets preference 'last'; no cover path by default.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.pursuits (id, user_id, title) values ('pcover-default', v_owner, 'Default test pursuit');
  v_text := (select pu.cover_image_preference from public.pursuits pu where pu.id = 'pcover-default');
  v_bool := (select pu.cover_image_path is null from public.pursuits pu where pu.id = 'pcover-default');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'last' and v_bool then 'PASS' else 'FAIL preference ' || coalesce(v_text, 'null') end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 3. Each constraint exists exactly once — the re-run guards add nothing
  --    a second time.
  -- ───────────────────────────────────────────────────────────────────────
  v_n := (select count(*) from pg_constraint c
          where c.conrelid = 'public.pursuits'::regclass
            and c.conname in ('pursuits_cover_image_preference_check', 'pursuits_cover_image_path_owned'));
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL expected 2 constraints, found ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 4-5. cover_image_preference only accepts 'first' / 'last'.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_preference = 'middle' where pursuits.id = 'pcover-priv';
    results := array_append(results, format('%s FAIL update succeeded, should have been rejected', v_i));
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      results := array_append(results, format('%s %s', v_i, case when v_constraint = 'pursuits_cover_image_preference_check' then 'PASS' else 'FAIL wrong constraint ' || coalesce(v_constraint, 'null') end));
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s ERROR %s: %s', v_i, v_sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_preference = 'first' where pursuits.id = 'pcover-priv';
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s ERROR %s: %s', v_i, v_sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 6-9. cover_image_path has to live under the owning user's own folder,
  --      with no '..' in it; null is fine.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_path = v_stranger::text || '/sneaky.jpg' where pursuits.id = 'pcover-priv';
    results := array_append(results, format('%s FAIL another user''s folder was accepted', v_i));
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      results := array_append(results, format('%s %s', v_i, case when v_constraint = 'pursuits_cover_image_path_owned' then 'PASS' else 'FAIL wrong constraint ' || coalesce(v_constraint, 'null') end));
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s ERROR %s: %s', v_i, v_sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_path = v_owner::text || '/../' || v_stranger::text || '/x.jpg' where pursuits.id = 'pcover-priv';
    results := array_append(results, format('%s FAIL a path with .. was accepted', v_i));
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      results := array_append(results, format('%s %s', v_i, case when v_constraint = 'pursuits_cover_image_path_owned' then 'PASS' else 'FAIL wrong constraint ' || coalesce(v_constraint, 'null') end));
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s ERROR %s: %s', v_i, v_sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_path = v_obj_priv where pursuits.id = 'pcover-priv';
    update public.pursuits set cover_image_path = null where pursuits.id = 'pcover-default';
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      results := array_append(results, format('%s ERROR %s: %s', v_i, v_sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 10. The policy exists exactly once and has the pursuits branch.
  -- ───────────────────────────────────────────────────────────────────────
  v_n := (select count(*) from pg_policies p
          where p.schemaname = 'storage' and p.tablename = 'objects'
            and p.policyname = 'moment-media: see photos of moments you can see'
            and p.qual like '%cover_image_path%');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL expected 1 policy with the pursuits branch, found ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11-16. moment-media SELECT policy: who can read each cover image path,
  --        under real RLS (role authenticated/anon, real auth.uid()).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL owner can''t read their own private cover' end));

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL a joined member can''t read the private cover' end));

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_bool := not exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL a stranger CAN read a private cover' end));

  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_pub);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL a stranger can''t read a shared cover' end));

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_pub);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL logged-out can''t read a shared cover' end));

  v_bool := not exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL logged-out CAN read a private cover' end));

  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
