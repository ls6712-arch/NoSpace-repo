-- Soosh: my_corner_affinity() (what a person's own activity says about which
-- Corners they like).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261029000000_corner_affinity.sql. Run before it, the script stops at the
-- first check and says so ("NOT APPLIED"); it never creates anything then.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results land
-- in the error message the Editor shows and a rollback is guaranteed whatever
-- happens. Each expected failure is its own begin...exception...end sub-block
-- with strict sqlstate handling (42501 for a privilege error); anything else
-- is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No
-- select-into, no returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   ME …5001, PEER_A …5002, PEER_B …5003, LONER …5004 (no activity at all)
--   Corners (all under old Space crafts-making): recs-check-a … recs-check-g
-- Every lookup is scoped to the fixture's own Corners (slug like
-- 'recs-check-%'), never to a whole live table. The function reads the whole
-- live posts table by design; live rows only change other Corners' scores, and
-- the checks below only read the fixture Corners.
--
-- Story:
--   ME     public post in A now; private (just_me) post in B 3 days ago;
--          public post in C 200 days ago; likes PEER_A's public post in D.
--   PEER_A public posts in A, E (so ME and PEER_A share A) and D.
--   PEER_B public posts in A, E, F.
--   -> E has 2 people who share A with ME: peers > 0 for ME.
--   -> F has 1 person only: absent from ME's output (no single person visible).
--   -> B (ME's private post) never shows up for anyone else.
--   -> A has 3 posters in 30 days: trending > 0 for everyone, incl. LONER.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_x double precision;
  v_y double precision;
  results text[] := '{}';
  v_me uuid := '00000000-0000-4000-8000-000000005001';
  v_pa uuid := '00000000-0000-4000-8000-000000005002';
  v_pb uuid := '00000000-0000-4000-8000-000000005003';
  v_loner uuid := '00000000-0000-4000-8000-000000005004';
  v_post_d bigint;
  v_owner_role text;
begin
  v_owner_role := current_user;

  if to_regprocedure('public.my_corner_affinity()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261029000000_corner_affinity.sql first, nothing was created)';
  end if;

  -- ───────── Fixture, as the connecting (table-owner) role, bypasses RLS ─────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_me, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recs-me@recs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_pa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recs-a@recs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_pb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recs-b@recs-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_loner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recs-loner@recs-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'recs-check-a', 'Recs check a'),
    ('crafts-making', 'recs-check-b', 'Recs check b'),
    ('crafts-making', 'recs-check-c', 'Recs check c'),
    ('crafts-making', 'recs-check-d', 'Recs check d'),
    ('crafts-making', 'recs-check-e', 'Recs check e'),
    ('crafts-making', 'recs-check-f', 'Recs check f'),
    ('crafts-making', 'recs-check-g', 'Recs check g');

  insert into public.posts (user_id, hobby_slug, corner, sub_hobby, type, media_url, caption, visibility, created_at) values
    (v_me, 'crafts-making', 'recs-check-a', 'recs-check-a', 'written', 'x', 'recs check', 'public', now() - interval '1 hour'),
    (v_me, 'crafts-making', 'recs-check-b', 'recs-check-b', 'written', 'x', 'recs check', 'just_me', now() - interval '3 days'),
    (v_me, 'crafts-making', 'recs-check-c', 'recs-check-c', 'written', 'x', 'recs check', 'public', now() - interval '200 days'),
    (v_pa, 'crafts-making', 'recs-check-a', 'recs-check-a', 'written', 'x', 'recs check', 'public', now() - interval '2 hours'),
    (v_pa, 'crafts-making', 'recs-check-e', 'recs-check-e', 'written', 'x', 'recs check', 'public', now() - interval '2 days'),
    (v_pa, 'crafts-making', 'recs-check-d', 'recs-check-d', 'written', 'x', 'recs check', 'public', now() - interval '3 days'),
    (v_pb, 'crafts-making', 'recs-check-a', 'recs-check-a', 'written', 'x', 'recs check', 'public', now() - interval '4 hours'),
    (v_pb, 'crafts-making', 'recs-check-e', 'recs-check-e', 'written', 'x', 'recs check', 'public', now() - interval '2 days'),
    (v_pb, 'crafts-making', 'recs-check-f', 'recs-check-f', 'written', 'x', 'recs check', 'public', now() - interval '2 days');

  v_post_d := (select p.id from public.posts p where p.user_id = v_pa and p.corner = 'recs-check-d');
  insert into public.post_likes (user_id, post_id) values (v_me, v_post_d);

  -- ───────── 1 to 8: as ME ─────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_me), true);

  v_i := v_i + 1;
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-a');
  results := array_append(results, case when v_x > 0.5 then format('%s PASS (a recent public Moment scores %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (mine for A should be > 0.5, got %s)', v_i, v_x) end);

  v_i := v_i + 1;
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-b');
  results := array_append(results, case when v_x > 0.4 then format('%s PASS (the caller''s own private Moment counts for them: %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (mine for B should be > 0.4, got %s)', v_i, v_x) end);

  v_i := v_i + 1;
  v_y := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-c');
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-a');
  results := array_append(results, case when v_y is not null and v_y > 0 and v_y < v_x / 4 then format('%s PASS (a 200 day old Moment is weak: %s vs %s)', v_i, round(v_y::numeric, 3), round(v_x::numeric, 2))
                                        else format('%s FAIL (old Moment should be far below recent: %s vs %s)', v_i, v_y, v_x) end);

  v_i := v_i + 1;
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-d');
  results := array_append(results, case when v_x > 0 then format('%s PASS (a like on a public Moment counts: %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (mine for D should be > 0, got %s)', v_i, v_x) end);

  v_i := v_i + 1;
  v_x := (select a.peers from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-e');
  results := array_append(results, case when v_x > 0 then format('%s PASS (E has peers: two people who share A with the caller post there: %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (peers for E should be > 0, got %s)', v_i, v_x) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-f');
  results := array_append(results, case when v_n = 0 then format('%s PASS (F, with one person behind it, is not in the output)', v_i)
                                        else format('%s FAIL (F has one poster and must be absent, rows: %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-g');
  results := array_append(results, case when v_n = 0 then format('%s PASS (G, nobody has touched it, is not in the output)', v_i)
                                        else format('%s FAIL (G should be absent, rows: %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = '');
  results := array_append(results, case when v_x > 0.5 then format('%s PASS (a Space-level row for crafts-making is there: %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (hobby-level mine should be > 0.5, got %s)', v_i, v_x) end);

  -- ───────── 9 to 10: as PEER_A, ME's private Moment must not show ─────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_pa), true);

  v_i := v_i + 1;
  v_n := (select count(*) from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-b');
  results := array_append(results, case when v_n = 0 then format('%s PASS (another person never sees the caller''s private Corner B)', v_i)
                                        else format('%s FAIL (B leaked to another person, rows: %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_x := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-a');
  v_y := (select a.mine from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-c');
  results := array_append(results, case when v_x > 0 and v_y is null then format('%s PASS (each person only gets their own activity: PEER_A has A, not C)', v_i)
                                        else format('%s FAIL (mine A=%s C=%s for PEER_A)', v_i, v_x, v_y) end);

  -- ───────── 11 to 12: as LONER, only the public signal ─────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_loner), true);

  v_i := v_i + 1;
  v_x := (select a.trending from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner = 'recs-check-a');
  results := array_append(results, case when v_x > 0 then format('%s PASS (A is trending for a person with no activity: %s)', v_i, round(v_x::numeric, 2))
                                        else format('%s FAIL (trending for A should be > 0, got %s)', v_i, v_x) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.my_corner_affinity() a where a.hobby_slug = 'crafts-making' and a.corner like 'recs-check-%' and a.mine > 0);
  results := array_append(results, case when v_n = 0 then format('%s PASS (no personal score for a person with no activity)', v_i)
                                        else format('%s FAIL (%s fixture Corners had mine > 0 for LONER)', v_i, v_n) end);

  -- ───────── 13: anonymous cannot call it ─────────
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.my_corner_affinity() a);
    results := array_append(results, format('%s FAIL (anon could call my_corner_affinity)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (anon is refused: 42501)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────── 14: security definer with a pinned search_path ─────────
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from pg_proc pr
           where pr.proname = 'my_corner_affinity' and pr.pronamespace = 'public'::regnamespace
             and pr.prosecdef and pr.proconfig is not null and 'search_path=public' = any (pr.proconfig));
  results := array_append(results, case when v_n = 1 then format('%s PASS (security definer, search_path pinned to public)', v_i)
                                        else format('%s FAIL (security definer / search_path check: %s)', v_i, v_n) end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
