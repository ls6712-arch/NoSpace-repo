-- Sushii: Spaces Rework — space_moments "at most 3 pinned" trigger.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20261004000000_spaces_rework_moments_pin_limit.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST …6001 — Space (Open) …0000000000f4 — Posts 900006001-900006005

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_bool boolean;
  results text[] := '{}';
begin
  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000006001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pinlimit-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values ('00000000-0000-4000-8000-0000000000f4', 'pin-limit-test', 'Pin Limit Test', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000006001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-000000006001', 'host', 'active', now() - interval '30 days');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    (900006001, '00000000-0000-4000-8000-000000006001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Pin limit test Moment 1.', 'public'),
    (900006002, '00000000-0000-4000-8000-000000006001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Pin limit test Moment 2.', 'public'),
    (900006003, '00000000-0000-4000-8000-000000006001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Pin limit test Moment 3.', 'public'),
    (900006004, '00000000-0000-4000-8000-000000006001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Pin limit test Moment 4.', 'public'),
    (900006005, '00000000-0000-4000-8000-000000006001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Pin limit test Moment 5.', 'public');

  insert into public.space_moments (space_id, post_id, featured) values
    ('00000000-0000-4000-8000-0000000000f4', 900006001, false),
    ('00000000-0000-4000-8000-0000000000f4', 900006002, false),
    ('00000000-0000-4000-8000-0000000000f4', 900006003, false),
    ('00000000-0000-4000-8000-0000000000f4', 900006004, false),
    ('00000000-0000-4000-8000-0000000000f4', 900006005, false);

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-3. Pinning the first 3 Moments succeeds (the old unique index —
  --      at most 1 featured — would have rejected the 2nd of these).
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006001;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006002;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006003;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4' and space_moments.featured = true;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5. Pinning a 4th, with 3 already pinned, fails with 'Unpin one
  --    first.' — the trigger's own message, verbatim.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006004;
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s %s', v_i, case when sqlerrm = 'Unpin one first.' then 'PASS' else 'FAIL ' || sqlerrm end));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 6. Re-affirming an already-featured row (no actual change) never
  --    hits the limit check at all, even while already at 3.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006001;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 7-8. Unpinning one, then pinning the 4th, succeeds — the 4th's slot
  --      freed up.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.space_moments set featured = false where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006001;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006004;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4' and space_moments.featured = true;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL' end));

  -- Pinned right now: 900006002, 900006003, 900006004. Unpinned: 900006001,
  -- 900006005 — neither removed.

  -- ───────────────────────────────────────────────────────────────────────
  -- 9-10. A host removing a pinned Moment (removed_by_host = true) also
  --       unpins it in the same write, whatever the caller passed for
  --       featured.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    update public.space_moments set removed_by_host = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006002;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select space_moments.featured into v_bool from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4' and space_moments.post_id = 900006002;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool = false then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11. A removed Moment no longer counts toward the 3-pin limit — with
  --     900006002 removed, only 2 remain actually pinned.
  -- ───────────────────────────────────────────────────────────────────────
  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4' and space_moments.featured = true;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 12-14. The count's own removed_by_host = false filter, isolated from
  --        the auto-unpin above (which already makes a featured+removed
  --        row impossible through this trigger in normal use): with the
  --        trigger briefly disabled, force 900006001 into that otherwise
  --        unreachable state directly (featured = true, removed_by_host =
  --        true) — an unfiltered count would now see 3 featured rows
  --        (900006001 fake, 900006003, 900006004) and wrongly refuse a
  --        genuine 3rd pin. With the filter, the real count is still 2,
  --        so pinning 900006005 through the normal, trigger-enabled path
  --        succeeds.
  -- ───────────────────────────────────────────────────────────────────────
  alter table public.space_moments disable trigger space_moments_featured_limit;
  update public.space_moments set featured = true, removed_by_host = true
  where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006001;
  alter table public.space_moments enable trigger space_moments_featured_limit;

  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4' and space_moments.featured = true;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL' end));

  v_i := v_i + 1;
  begin
    update public.space_moments set featured = true where space_id = '00000000-0000-4000-8000-0000000000f4' and post_id = 900006005;
    results := array_append(results, format('%s PASS', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s FAIL %s', v_i, sqlerrm));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f4'
    and space_moments.featured = true and space_moments.removed_by_host = false;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
