-- Sushii: Spaces Rework — set_space_corners RPC and the space_corners
-- policy change that goes with it.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260930000000_spaces_rework_set_space_corners.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome. Expected-failure checks are their own
-- begin...exception...end sub-block, classifying what's caught
-- (raise_exception = P0001, insufficient_privilege = 42501 for the
-- dropped-policy check; anything else recorded as
-- 'N ERROR <sqlstate>: <message>', never silently treated as a pass).
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST …5001, NON_HOST …5002
--   SPACE (Open, active) …0000000000f2 — starts with Corners [C1 (primary), C2]
--   DEL_SPACE (Open, deleted, host row still active) …0000000000f3
--   4 throwaway Corners (space_slug = 'crafts-making'), ids captured at
--   fixture time since corners.id is an identity column

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_c1 bigint;
  v_c2 bigint;
  v_c3 bigint;
  v_c4 bigint;
  v_primary bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000005001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5e-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000005002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5e-nonhost@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5e-corner-1', 'Phase5e Corner 1') returning id into v_c1;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5e-corner-2', 'Phase5e Corner 2') returning id into v_c2;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5e-corner-3', 'Phase5e Corner 3') returning id into v_c3;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5e-corner-4', 'Phase5e Corner 4') returning id into v_c4;

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values
    ('00000000-0000-4000-8000-0000000000f2', 'phase5e-test-space', 'Phase 5e Test Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000005001', 'active'),
    ('00000000-0000-4000-8000-0000000000f3', 'phase5e-test-del', 'Phase 5e Test DEL', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000005001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000005001', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000005001', 'host', 'active', now() - interval '30 days');

  insert into public.space_corners (space_id, corner_id, is_primary) values
    ('00000000-0000-4000-8000-0000000000f2', v_c1, true),
    ('00000000-0000-4000-8000-0000000000f2', v_c2, false);

  -- Soft-delete DEL_SPACE directly — its host row (above) stays active,
  -- same as phase5_backend_check's DEL fixture, so this exercises
  -- assert_space_active's own gate rather than is_space_host's.
  update public.spaces set status = 'deleted' where id = '00000000-0000-4000-8000-0000000000f3';

  raise notice '--- fixture ready, running checks ---';

  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. Not a host — refused.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000005002"}', true);
  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[v_c3]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000005001"}', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- 2-5. Host, but a bad p_corner_ids: empty, >3, duplicate, nonexistent.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[]::bigint[]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[v_c1, v_c2, v_c3, v_c4]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[v_c1, v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[999999999]::bigint[]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 6-7. Success: swap [C1, C2] -> [C3, C4] (both replaced, primary
  --      moves to C3), then swap down to a single Corner [C2] (both the
  --      earlier delete's rows AND the first swap's rows are gone —
  --      nothing lingers across repeated calls).
  -- ───────────────────────────────────────────────────────────────────────
  perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[v_c3, v_c4]);

  select count(*) into v_n from space_corners where space_corners.space_id = '00000000-0000-4000-8000-0000000000f2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from space_corners
  where space_corners.space_id = '00000000-0000-4000-8000-0000000000f2' and space_corners.corner_id in (v_c3, v_c4);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL' end));

  select space_corners.corner_id into v_primary from space_corners
  where space_corners.space_id = '00000000-0000-4000-8000-0000000000f2' and space_corners.is_primary;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_primary = v_c3 then 'PASS' else 'FAIL' end));

  perform public.set_space_corners('00000000-0000-4000-8000-0000000000f2', array[v_c2]);

  select count(*) into v_n from space_corners where space_corners.space_id = '00000000-0000-4000-8000-0000000000f2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select space_corners.corner_id into v_primary from space_corners
  where space_corners.space_id = '00000000-0000-4000-8000-0000000000f2' and space_corners.is_primary;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_primary = v_c2 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 8. assert_space_active's own gate — DEL_SPACE's host row is still
  --    active (is_space_host alone would pass), but the Space is deleted.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.set_space_corners('00000000-0000-4000-8000-0000000000f3', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 9. Direct table write is gone — the host's own former policy no
  --    longer exists, so a plain insert (bypassing the RPC entirely) is
  --    blocked by RLS itself (42501), not just left unvalidated.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    insert into space_corners (space_id, corner_id, is_primary) values ('00000000-0000-4000-8000-0000000000f2', v_c1, false);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
