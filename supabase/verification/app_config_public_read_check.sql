-- app_config public read — verification.
--
-- Not a migration — nothing here should alter the schema (fixture rows and
-- the one app_config UPDATE used to prove the admin-only write policy are
-- rolled back unconditionally at the end). Run this AFTER
-- 20261001120000_app_config_public_read.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   MEMBER (non-admin) …a101, ADMIN …a102.
--
-- What this does NOT cover: CornersContext.tsx's switch from .single() to
-- .maybeSingle() is a client-side change with no SQL surface — that's
-- covered by typecheck/build, not here. This script only proves the RLS
-- policy itself now does what the app needs: readable without a session,
-- still writable only by an admin.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_policyname text;
  v_qual text;
  v_roles text;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-3. The policy itself: public, SELECT, unconditional qual.
  -- ───────────────────────────────────────────────────────────────────────
  select policyname, roles::text, qual into v_policyname, v_roles, v_qual
    from pg_policies
    where schemaname = 'public' and tablename = 'app_config'
      and cmd = 'SELECT';

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when v_policyname = 'app_config is publicly readable' then 'PASS' else 'FAIL name=' || coalesce(v_policyname, 'null') end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when v_roles = '{public}' then 'PASS' else 'FAIL roles=' || coalesce(v_roles, 'null') end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when v_qual = 'true' then 'PASS' else 'FAIL qual=' || coalesce(v_qual, 'null') end));

  -- The old signed-in-only policy is gone, not just shadowed by the new one.
  v_i := v_i + 1;
  select count(*) into v_n from pg_policies
    where schemaname = 'public' and tablename = 'app_config'
      and policyname = 'app_config is readable when signed in';
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL old policy still present' end));

  -- Admin write policy untouched.
  v_i := v_i + 1;
  select count(*) into v_n from pg_policies
    where schemaname = 'public' and tablename = 'app_config'
      and policyname = 'admins manage app_config' and cmd = 'ALL';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-00000000a101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-config-member@config-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-00000000a102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-config-admin@config-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set is_admin = false where id = '00000000-0000-4000-8000-00000000a101';
  update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-00000000a102';

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 6. Signed out (anon, no session at all) — this is the exact caller
  --    CornersContext.refresh() used to 406 for. Expect to see all 4
  --    seeded keys, not 0.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into v_n from public.app_config
    where key in ('corner_min_moments_30d', 'space_creation_limit', 'trademark_blocklist', 'invites_per_new_member');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 4 then 'PASS' else 'FAIL saw ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 7. Authenticated, non-admin (MEMBER) — same read, unchanged from before.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a101"}', true);
  select count(*) into v_n from public.app_config
    where key in ('corner_min_moments_30d', 'space_creation_limit', 'trademark_blocklist', 'invites_per_new_member');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 4 then 'PASS' else 'FAIL saw ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 8. A non-admin's UPDATE touches 0 rows — RLS filters it out silently
  --    (admins-only ALL policy), it doesn't error. Confirms read opening up
  --    didn't also open up writes.
  -- ───────────────────────────────────────────────────────────────────────
  update public.app_config set value = '999'::jsonb where key = 'corner_min_moments_30d';
  get diagnostics v_n = row_count;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL updated ' || v_n || ' row(s)' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 9. An admin's UPDATE still works.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a102"}', true);
  update public.app_config set value = '999'::jsonb where key = 'corner_min_moments_30d';
  get diagnostics v_n = row_count;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL updated ' || v_n || ' row(s)' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists, including the admin UPDATE
  -- in #9) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
