-- Sushii: Spaces Rework Phase 3 — membership & access RLS simulation.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260925000000_spaces_rework_phase3_membership.sql.
--
-- Everything — fixture setup AND every check — runs inside ONE do $$ ... $$
-- block, which always ends by RAISE EXCEPTION'ing a single message
-- carrying every check's result: 'RESULTS: 1 PASS, 2 PASS, 3 FAIL, ...'.
-- That exception is what the Supabase SQL Editor will show as the error
-- text after "Failed to run sql query:" — that IS the output, not a
-- failure of the script. It also guarantees a rollback: raising out of the
-- block aborts the whole transaction, so nothing this script does (the
-- throwaway Space, users, Moments, memberships) ever persists, whether
-- every check passes or not. If fixture setup itself fails (e.g. this
-- project's auth.users needs a column this script doesn't set), that
-- error surfaces exactly the same way, in the same place.
--
-- Fixed ids throughout, so the whole script can reference them as literals
-- with no need to look anything up mid-script:
--   host                          00000000-0000-4000-8000-000000000001
--   active member (Space A)       00000000-0000-4000-8000-000000000002
--   pending member (Space A)      00000000-0000-4000-8000-000000000003
--   banned member (Space A)       00000000-0000-4000-8000-000000000004
--   active member (Space B only)  00000000-0000-4000-8000-000000000005
--   non-member (of either)        00000000-0000-4000-8000-000000000006
--   Space A — Closed, posting_mode = 'approval'
--                                  00000000-0000-4000-8000-0000000000a1
--   Space B — Open, posting_mode = 'immediate'
--                                  00000000-0000-4000-8000-0000000000a2
--   active member's Moment, linked into A (trigger sets it 'pending')
--                                  900000001
--   non-member's Moment, never linked (used for the link-attack check)
--                                  900000002
--   Space-B member's Moment, linked into B (trigger sets it 'approved')
--                                  900000003

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_n2 int;
  results text[] := '{}';
begin
  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — runs as the connecting (table-owner) role, which bypasses
  -- RLS by default for direct writes. This is setup, not itself a test of
  -- the RPCs from the migration; membership/request/link rows are
  -- inserted directly so every check below starts from an exact, known
  -- state.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-host@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-active@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-pending@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-banned@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-otherspace@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-nonmember@phase3-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by)
  values
    ('00000000-0000-4000-8000-0000000000a1', 'phase3-test-closed-space', 'Phase 3 Test Closed Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'approval', null, '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-0000000000a2', 'phase3-test-open-space', 'Phase 3 Test Open Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000000001');

  insert into public.space_private_details (space_id, exact_address) values
    ('00000000-0000-4000-8000-0000000000a1', '123 Test St, Testville'),
    ('00000000-0000-4000-8000-0000000000a2', '456 Open Ave, Openville');

  insert into public.space_members (space_id, user_id, role, status) values
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'host', 'active'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000002', 'member', 'active'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000003', 'member', 'pending'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000004', 'member', 'banned'),
    ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'host', 'active'),
    ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000005', 'member', 'active');

  insert into public.space_join_requests (space_id, user_id, answers) values
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000003', '["Because I love pottery."]'::jsonb);

  -- type = 'photo': confirmed live, no assumptions needed (posts_type_check
  -- currently allows photo/video/text/written — fix/posts-type-check-written
  -- is applied). 'photo' is used here anyway since it needs no dependency on
  -- that fact holding on whatever database this runs against next; swap
  -- freely if that's ever inconvenient. media_url is NOT NULL with no
  -- default regardless of type, so a placeholder is required either way.
  --
  -- docs/schema-baseline-20260920.sql is a point-in-time snapshot, not a
  -- live source of truth — it already disagreed with production once this
  -- session (the messages policies) and again here (posts_type_check). To
  -- check what a constraint actually allows right now, query pg_constraint
  -- directly rather than trusting that file:
  --   select conname, pg_get_constraintdef(oid) from pg_constraint
  --   where conname in ('posts_type_check', 'posts_visibility_check');
  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    (900000001, '00000000-0000-4000-8000-000000000002', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Phase 3 test Moment (Space A active member).', 'public'),
    (900000002, '00000000-0000-4000-8000-000000000006', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Phase 3 test Moment (non-member).', 'public'),
    (900000003, '00000000-0000-4000-8000-000000000005', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Phase 3 test Moment (Space B member).', 'public');

  -- Space A's posting_mode is 'approval', so this link comes out 'pending'
  -- (visible only to its poster and A's hosts). Space B's is 'immediate',
  -- so that link comes out 'approved'.
  insert into public.space_moments (space_id, post_id) values
    ('00000000-0000-4000-8000-0000000000a1', 900000001),
    ('00000000-0000-4000-8000-0000000000a2', 900000003);

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-2. Non-member reads Space A (Closed) — expect 0 Moments, 0 address.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 3-4. Pending member — expect 0, 0.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 5-6. Banned member — expect 0, 0.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 7-8. Approved/active member — expect 1 (their own pending-but-poster-
  -- visible Moment), 1 (they're an active member, address is theirs to see).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 9-10. Anon (logged out) — expect 0, 0.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 11-12. Active member of a DIFFERENT Space (B), reading Space A —
  -- expect 0, 0 (membership doesn't cross Spaces).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 13. Pending member tries to self-approve via a direct UPDATE — must
  -- affect 0 rows, or error; either counts as PASS.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003"}', true);
  v_i := v_i + 1;
  begin
    update public.space_members set status = 'active'
    where space_id = '00000000-0000-4000-8000-0000000000a1' and user_id = '00000000-0000-4000-8000-000000000003';
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;

  -- 14-15. Banned member tries delete-and-rejoin — both must fail.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004"}', true);
  v_i := v_i + 1;
  begin
    delete from public.space_members
    where space_id = '00000000-0000-4000-8000-0000000000a1' and user_id = '00000000-0000-4000-8000-000000000004';
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;
  v_i := v_i + 1;
  begin
    insert into public.space_members (space_id, user_id, role, status)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000004', 'member', 'active');
    results := array_append(results, format('%s FAIL', v_i));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;

  -- 16-17. Non-member tries to INSERT themselves as active, then as host —
  -- both must fail.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006"}', true);
  v_i := v_i + 1;
  begin
    insert into public.space_members (space_id, user_id, role, status)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000006', 'member', 'active');
    results := array_append(results, format('%s FAIL', v_i));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;
  v_i := v_i + 1;
  begin
    insert into public.space_members (space_id, user_id, role, status)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000006', 'host', 'active');
    results := array_append(results, format('%s FAIL', v_i));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;

  -- 18. Non-member tries to link their own Moment into the Closed Space —
  -- must fail.
  v_i := v_i + 1;
  begin
    insert into public.space_moments (space_id, post_id)
    values ('00000000-0000-4000-8000-0000000000a1', 900000002);
    results := array_append(results, format('%s FAIL', v_i));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;

  -- 19-20. Open Space (B): non-member CAN read Moments (not over-
  -- restricting an Open Space), but still cannot read the exact address.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006"}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 21-22. Open Space (B): anon CAN read Moments, still cannot read the
  -- exact address.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into v_n from public.space_moments where space_id = '00000000-0000-4000-8000-0000000000a2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_private_details where space_id = '00000000-0000-4000-8000-0000000000a2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 23-24. A regular active member (Space A) cannot see pending/banned
  -- roster rows, or any join_requests row (only hosts and the requester
  -- themselves can).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', true);
  select count(*) into v_n from public.space_members
  where space_id = '00000000-0000-4000-8000-0000000000a1' and status in ('pending', 'banned');
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_join_requests where space_id = '00000000-0000-4000-8000-0000000000a1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 25-26. A non-member of the Closed Space (A) can see its hosts, but
  -- not its (active) member list.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006"}', true);
  select count(*) into v_n from public.space_members
  where space_id = '00000000-0000-4000-8000-0000000000a1' and role = 'host';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.space_members
  where space_id = '00000000-0000-4000-8000-0000000000a1' and role = 'member' and status = 'active';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 27. The active member can't approve their own pending Moment link via
  -- a direct UPDATE — must affect 0 rows, or error.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', true);
  v_i := v_i + 1;
  begin
    update public.space_moments set status = 'approved'
    where space_id = '00000000-0000-4000-8000-0000000000a1' and post_id = 900000001;
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception when others then
    results := array_append(results, format('%s PASS', v_i));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

-- Unreachable in the normal path (the do block above always raises), kept
-- as a defensive no-op in case the Editor's connection is somehow reused
-- afterward.
rollback;
