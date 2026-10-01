-- Pending accounts can't join a Pursuit by link — verification.
--
-- Not a migration. Run this AFTER
-- 20261011000000_pending_cannot_join_pursuit_link.sql. One transaction, one
-- do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...'
-- so the results land in the error message and every fixture row rolls back.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   OWNER (active) …7101, JOINER (active) …7102, PENDING …7103.
--
-- What this does NOT cover: the app screens. Root.tsx already sends a
-- pending account to /welcome before /join/:token renders; this script
-- proves the database refuses even when the RPC is called directly.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_pid text;
  results text[] := '{}';
  v_owner_role text;
  v_pursuit_id text := 'pend-join-check-pursuit';
  v_token text := 'pendjoincheck0000000000000000001';
  v_revoked_token text := 'pendjoincheck0000000000000000002';
  v_owner uuid := '00000000-0000-4000-8000-000000007101';
  v_joiner uuid := '00000000-0000-4000-8000-000000007102';
  v_pending uuid := '00000000-0000-4000-8000-000000007103';
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pendjoin-owner@pendjoin-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_joiner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pendjoin-joiner@pendjoin-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_pending, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pendjoin-pending@pendjoin-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- handle_new_user created these profiles as 'pending' (the Step 2
  -- default). Activate the owner and the joiner only.
  update public.profiles set access = 'active'
  where public.profiles.id in (v_owner, v_joiner);

  insert into public.pursuits (id, user_id, title)
  values (v_pursuit_id, v_owner, 'Pending-join check (rolled back)');

  insert into public.pursuit_invite_links (token, pursuit_id, created_by, revoked_at)
  values
    (v_token, v_pursuit_id, v_owner, null),
    (v_revoked_token, v_pursuit_id, v_owner, now());

  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. A pending account is refused with 42501.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_pending), true);
  v_i := v_i + 1;
  begin
    perform public.join_pursuit_via_link(v_token);
    results := array_append(results, format('%s FAIL pending account joined', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 2. …and no membership row was written for them.
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  select count(*) into v_n from public.pursuit_members pm
    where pm.pursuit_id = v_pursuit_id and pm.user_id = v_pending;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));
  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 3. An active account still joins, unchanged.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_joiner), true);
  v_i := v_i + 1;
  begin
    v_pid := public.join_pursuit_via_link(v_token);
    results := array_append(results, format('%s %s', v_i, case when v_pid = v_pursuit_id then 'PASS' else 'FAIL pid=' || coalesce(v_pid, 'null') end));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  select count(*) into v_n from public.pursuit_members pm
    where pm.pursuit_id = v_pursuit_id and pm.user_id = v_joiner and pm.status = 'joined';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));
  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 5. A revoked link is still refused for an active account (P0001).
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.join_pursuit_via_link(v_revoked_token);
    results := array_append(results, format('%s FAIL revoked link worked', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
