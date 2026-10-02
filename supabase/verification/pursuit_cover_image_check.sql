-- Sushii: Pursuit cover image (20261011000000_pursuit_cover_image.sql).
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20261011000000_pursuit_cover_image.sql.
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

begin;

do $$
declare
  v_i int := 0;
  v_owner uuid := '00000000-0000-4000-8000-000000007001';
  v_member uuid := '00000000-0000-4000-8000-000000007002';
  v_stranger uuid := '00000000-0000-4000-8000-000000007003';
  v_obj_priv text;
  v_obj_pub text;
  v_bool boolean;
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

  update public.pursuits set cover_image_path = v_obj_priv where id = 'pcover-priv';
  update public.pursuits set cover_image_path = v_obj_pub where id = 'pcover-pub';

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-2. cover_image_preference only accepts 'first'/'last'.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_preference = 'middle' where id = 'pcover-priv';
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_preference = 'first' where id = 'pcover-priv';
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 3-4. cover_image_path has to live under the owning user's own folder.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_path = v_stranger::text || '/sneaky.jpg' where id = 'pcover-priv';
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.pursuits set cover_image_path = v_obj_priv where id = 'pcover-priv';
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 5-9. moment-media SELECT policy: who can read each cover image path,
  --      under real RLS (role authenticated/anon, real auth.uid()).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  select exists(select 1 from storage.objects where bucket_id = 'moment-media' and name = v_obj_priv)
    into v_bool;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL' end));

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  select exists(select 1 from storage.objects where bucket_id = 'moment-media' and name = v_obj_priv)
    into v_bool;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL' end));

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  select not exists(select 1 from storage.objects where bucket_id = 'moment-media' and name = v_obj_priv)
    into v_bool;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL' end));

  select exists(select 1 from storage.objects where bucket_id = 'moment-media' and name = v_obj_pub)
    into v_bool;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL' end));

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select exists(select 1 from storage.objects where bucket_id = 'moment-media' and name = v_obj_pub)
    into v_bool;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS' else 'FAIL' end));
  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
