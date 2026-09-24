-- Sushii: Spaces Rework Phase 4 follow-up — read_only Space enforcement.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260926010000_phase4_followup_active_space_checks.sql.
--
-- Same pattern as the other verification scripts: one transaction, one
-- do $$ ... $$ block, fixture + checks, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so results land in the error message
-- the Editor shows and a rollback is guaranteed regardless of outcome.
--
-- Fixed ids, a distinct block from the other scripts' own ranges:
--   K_HOST   00000000-0000-4000-8000-000000001101
--   K_MEMBER 00000000-0000-4000-8000-000000001102 (already an active
--            member from before the Space went read_only)
--   K_JOINER 00000000-0000-4000-8000-000000001103 (never a member)
--   Space K  00000000-0000-4000-8000-0000000000c1 — created directly as
--            status = 'read_only', so no earlier "was active" step is
--            needed to set this fixture up.
--   K_MEMBER's Moment 900003001, never linked (the link attempt is what's
--   under test).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
begin
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000001101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4f-k-host@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4f-k-member@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4f-k-joiner@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values (
    '00000000-0000-4000-8000-0000000000c1', 'phase4-followup-test-k', 'Phase 4 Follow-up Test K',
    'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null,
    '00000000-0000-4000-8000-000000001101', 'read_only'
  );

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000001101', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000001102', 'member', 'active', now() - interval '30 days');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value
  values (900003001, '00000000-0000-4000-8000-000000001102', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Phase 4 follow-up test Moment.', 'public');

  raise notice '--- fixture ready, running checks ---';

  -- 1. A non-member can't join a read_only Space.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001103"}', true);
  v_i := v_i + 1;
  begin
    perform public.request_or_join_space('00000000-0000-4000-8000-0000000000c1');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 2. An existing active member can't link a NEW Moment into a Space
  -- that's since gone read_only.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001102"}', true);
  v_i := v_i + 1;
  begin
    insert into public.space_moments (space_id, post_id)
    values ('00000000-0000-4000-8000-0000000000c1', 900003001);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
