-- Sushii: Spaces Rework — host-authored Moments skip approval, plus
-- approve_space_moment / decline_space_moment.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20261005000000_spaces_rework_moment_approval.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST …7001, MEMBER …7002 — Space (Open, posting_mode='approval')
--   …0000000000f5 — Posts 900007001-900007003

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  results text[] := '{}';
  v_owner_role text;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS. The
  -- space_moments inserts below still fire set_space_moment_status()
  -- (triggers aren't RLS) — that's the point, it's under test.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000007001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approval-host@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000007002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approval-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values ('00000000-0000-4000-8000-0000000000f5', 'moment-approval-test', 'Moment Approval Test', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'approval', null, '00000000-0000-4000-8000-000000007001', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-000000007001', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-000000007002', 'member', 'active', now() - interval '20 days');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    (900007001, '00000000-0000-4000-8000-000000007001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Host''s own Moment.', 'public'),
    (900007002, '00000000-0000-4000-8000-000000007002', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Member Moment (approved later).', 'public'),
    (900007003, '00000000-0000-4000-8000-000000007002', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Member Moment (declined later).', 'public');

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. A host's own Moment lands 'approved' even though the Space's
  --    posting_mode is 'approval'.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000f5', 900007001);
  select space_moments.status into v_text from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f5' and space_moments.post_id = 900007001;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'approved' then 'PASS' else 'FAIL ' || v_text end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 2-3. A member's own Moment still lands 'pending' — the fix only
  --      exempts hosts, everyone else is unchanged.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000f5', 900007002);
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000f5', 900007003);
  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f5'
    and space_moments.post_id in (900007002, 900007003) and space_moments.status = 'pending';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 4. Non-host can't approve — including the Moment's own author, who is
  --    a member here, not a host.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000007002"}', true);
  v_i := v_i + 1;
  begin
    perform public.approve_space_moment('00000000-0000-4000-8000-0000000000f5', 900007002);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s %s', v_i, case when sqlerrm = 'Only a host can do that.' then 'PASS' else 'FAIL ' || sqlerrm end));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 5. Same for decline — the author can't decline their own pending
  --    Moment either, not being a host.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.decline_space_moment('00000000-0000-4000-8000-0000000000f5', 900007003);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s %s', v_i, case when sqlerrm = 'Only a host can do that.' then 'PASS' else 'FAIL ' || sqlerrm end));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 6-7. The host can approve, and can decline — the two real paths.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000007001"}', true);
  v_i := v_i + 1;
  begin
    perform public.approve_space_moment('00000000-0000-4000-8000-0000000000f5', 900007002);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.decline_space_moment('00000000-0000-4000-8000-0000000000f5', 900007003);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);

  -- 8. The approved one really is approved now.
  select space_moments.status into v_text from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f5' and space_moments.post_id = 900007002;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'approved' then 'PASS' else 'FAIL ' || coalesce(v_text, 'null') end));

  -- 9. The declined link is gone.
  select count(*) into v_n from space_moments
  where space_moments.space_id = '00000000-0000-4000-8000-0000000000f5' and space_moments.post_id = 900007003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 10. The declined Moment's own post is untouched — it stays in the
  --     author's log, only the Space link was removed.
  select count(*) into v_n from posts where posts.id = 900007003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11. Declining it again (the link is already gone) fails with a
  --     specific message rather than silently no-op'ing.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000007001"}', true);
  v_i := v_i + 1;
  begin
    perform public.decline_space_moment('00000000-0000-4000-8000-0000000000f5', 900007003);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s %s', v_i, case when sqlerrm = 'That Moment link no longer exists.' then 'PASS' else 'FAIL ' || sqlerrm end));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
