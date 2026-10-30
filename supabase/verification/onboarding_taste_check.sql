-- Soosh onboarding PR 3: taste (picks, free_windows, monthly_budget, user_passes,
-- corners_with_activity, pursuit_invite_corner).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261105000000_onboarding_taste.sql. Run before it, the script stops at the first
-- check and says so ("NOT APPLIED"); it never creates anything then.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$ block, ends
-- unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results land in the error message
-- and a rollback is guaranteed. Each expected failure is its own begin...exception...end
-- sub-block with strict sqlstate handling; anything unexpected is recorded as
-- 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no returning-into, no
-- delete (per CLAUDE.md): deleting your own pass is checked through its policy instead.
--
-- Fixed ids: A …6101 and B …6102 (people), H …6103 (host). Spaces …6201 (open, in the
-- fixture city), …6202 (closed, same city), …6203 (open, another city). Corners are
-- 'taste-check/corner-a' and 'taste-check/corner-b'. Every count is scoped to those ids
-- or to that key prefix, never to a whole live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000006101';
  v_b uuid := '00000000-0000-4000-8000-000000006102';
  v_h uuid := '00000000-0000-4000-8000-000000006103';
  v_open uuid := '00000000-0000-4000-8000-000000006201';
  v_closed uuid := '00000000-0000-4000-8000-000000006202';
  v_far uuid := '00000000-0000-4000-8000-000000006203';
  v_corner_a bigint;
  v_corner_b bigint;
begin
  v_owner_role := current_user;

  if to_regclass('public.user_passes') is null
     or to_regprocedure('public.corners_with_activity(text, integer)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261105000000_onboarding_taste.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'taste-a@taste-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'taste-b@taste-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_h, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'taste-h@taste-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_a, v_b, v_h) and p.access = 'active');
  results := array_append(results, case when v_n = 3 then format('%s PASS (3 active fixture accounts)', v_i)
                                        else format('%s FAIL (expected 3 active, got %s)', v_i, v_n) end);

  insert into public.corners (space_slug, slug, name) values ('taste-check', 'corner-a', 'Taste check A'), ('taste-check', 'corner-b', 'Taste check B');
  v_corner_a := (select c.id from public.corners c where c.space_slug = 'taste-check' and c.slug = 'corner-a');
  v_corner_b := (select c.id from public.corners c where c.space_slug = 'taste-check' and c.slug = 'corner-b');

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, created_by, status, city)
  values
    (v_open, 'taste-check-open', 'Taste check open', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_h, 'active', 'Tastecheckville'),
    (v_closed, 'taste-check-closed', 'Taste check closed', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'closed', 'immediate', v_h, 'active', 'Tastecheckville'),
    (v_far, 'taste-check-far', 'Taste check far', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_h, 'active', 'Elsewhereton');

  insert into public.space_corners (space_id, corner_id, is_primary)
  values (v_open, v_corner_a, true), (v_closed, v_corner_a, true), (v_far, v_corner_a, true);

  -- Corner A gets one real event in the next 14 days in the open Space. The rest must not count:
  -- cancelled, 20 days away, in a closed Space, in another city.
  insert into public.space_events (space_id, title, starts_at, timezone, meets, created_by, status, city) values
    (v_open, 'Taste check real', now() + interval '3 days', 'UTC', 'in_person', v_h, 'scheduled', null),
    (v_open, 'Taste check cancelled', now() + interval '3 days', 'UTC', 'in_person', v_h, 'cancelled', null),
    (v_open, 'Taste check too far ahead', now() + interval '20 days', 'UTC', 'in_person', v_h, 'scheduled', null),
    (v_open, 'Taste check in the past', now() - interval '2 days', 'UTC', 'in_person', v_h, 'scheduled', null),
    (v_closed, 'Taste check closed space', now() + interval '2 days', 'UTC', 'in_person', v_h, 'scheduled', null),
    (v_far, 'Taste check other city', now() + interval '2 days', 'UTC', 'in_person', v_h, 'scheduled', null);

  -- Corner B gets one open Pursuit with room (owner plus nobody, capacity 4). A full one, a friends one
  -- and one in the closed Space must not count.
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, shared, mode, visibility, capacity, space_id, ends_at) values
    ('taste-check-open', v_h, 'Taste check open', 'taste-check', 'corner-b', true, 'together', 'open', 4, v_open, now() + interval '20 days'),
    ('taste-check-full', v_h, 'Taste check full', 'taste-check', 'corner-c', true, 'together', 'open', 2, v_open, now() + interval '20 days'),
    ('taste-check-friends', v_h, 'Taste check friends', 'taste-check', 'corner-d', false, 'together', 'friends', null, v_open, null),
    ('taste-check-closed', v_h, 'Taste check closed', 'taste-check', 'corner-e', true, 'together', 'open', 4, v_closed, now() + interval '20 days');
  insert into public.pursuit_members (pursuit_id, user_id, role, status) values ('taste-check-full', v_b, 'member', 'joined');

  insert into public.pursuit_invite_links (token, pursuit_id, created_by) values
    ('taste-check-token', 'taste-check-open', v_h),
    ('taste-check-revoked', 'taste-check-open', v_h);
  update public.pursuit_invite_links l set revoked_at = now() where l.token = 'taste-check-revoked';

  -- ───────────────────────────────────────────────────────────────────────
  -- The taste columns, as person A.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, picks, free_windows, monthly_budget)
    values (v_a, array['sports-fitness/running', 'food-cooking/pasta', 'taste-check/corner-a'], array['sat-day', 'thu-eve'], 100);
    v_n := (select count(*) from public.profile_private pp where pp.user_id = v_a and cardinality(pp.picks) = 3 and cardinality(pp.free_windows) = 2 and pp.monthly_budget = 100);
    results := array_append(results, case when v_n = 1 then format('%s PASS (picks, windows and a budget are saved)', v_i)
                                          else format('%s FAIL (not saved as expected)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set picks = array['sports-fitness/running', 'food-cooking/pasta'] where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (2 picks were saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (fewer than 3 picks refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set picks = array['sports-fitness/running', 'food-cooking/pasta', 'Not A Key'] where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (a pick that is not a Corner key was saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (a pick that is not a Corner key refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- No maximum in the product: 40 picks is fine.
  v_i := v_i + 1;
  begin
    update public.profile_private pp
    set picks = (select array_agg('taste-check/corner-' || g.n::text) from generate_series(1, 40) g(n))
    where pp.user_id = v_a;
    v_n := (select cardinality(pp.picks) from public.profile_private pp where pp.user_id = v_a);
    results := array_append(results, case when v_n = 40 then format('%s PASS (40 picks accepted: no product maximum)', v_i)
                                          else format('%s FAIL (stored %s)', v_i, v_n) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set free_windows = array['sat-day', 'sat-night'] where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (an unknown window was saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an unknown window refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set free_windows = (select array_agg('mon-day'::text) from generate_series(1, 15)) where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (15 windows were saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (more than 14 windows refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set monthly_budget = 75 where pp.user_id = v_a;
    results := array_append(results, format('%s FAIL (a budget of 75 was saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (a budget that is not 0, 50, 100 or 200 refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private pp set monthly_budget = 0 where pp.user_id = v_a;
    update public.profile_private pp set monthly_budget = null where pp.user_id = v_a;
    v_n := (select count(*) from public.profile_private pp where pp.user_id = v_a and pp.monthly_budget is null);
    results := array_append(results, case when v_n = 1 then format('%s PASS (0 is a budget, and a skipped budget is null)', v_i)
                                          else format('%s FAIL (budget not null after skip)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- What is already yours.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    insert into public.user_passes (user_id, kind, label, place) values (v_a, 'climbing', 'Climbing', 'The Gym'), (v_a, 'library', 'Library', null);
    v_n := (select count(*) from public.user_passes up where up.user_id = v_a);
    results := array_append(results, case when v_n = 2 then format('%s PASS (A adds 2 passes, one with a place and one without)', v_i)
                                          else format('%s FAIL (A has %s passes)', v_i, v_n) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.user_passes (user_id, kind, label) values (v_a, 'yoga', 'Yoga');
    results := array_append(results, format('%s FAIL (an unknown kind was saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an unknown kind refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.user_passes (user_id, kind, label) values (v_a, 'gear', '');
    results := array_append(results, format('%s FAIL (an empty label was saved)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an empty label refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Person B cannot see, add to, change or (by policy) remove A's passes.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_i := v_i + 1;
  v_n := (select count(*) from public.user_passes up where up.user_id in (v_a, v_b));
  results := array_append(results, case when v_n = 0 then format('%s PASS (B reads none of A''s passes)', v_i)
                                        else format('%s FAIL (B sees %s)', v_i, v_n) end);

  v_i := v_i + 1;
  begin
    insert into public.user_passes (user_id, kind, label) values (v_a, 'museum', 'Museum');
    results := array_append(results, format('%s FAIL (B added a pass for A)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (B cannot add a pass for A)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  update public.user_passes up set place = 'Hijacked' where up.user_id = v_a;
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.user_passes up where up.user_id = v_a and up.place = 'Hijacked');
  results := array_append(results, case when v_n = 0 then format('%s PASS (B cannot change A''s passes)', v_i)
                                        else format('%s FAIL (B changed %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_policy po where po.polrelid = 'public.user_passes'::regclass and po.polcmd = 'd');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a delete policy exists, owner only)', v_i)
                                        else format('%s FAIL (%s delete policies)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_class cl where cl.oid = 'public.user_passes'::regclass and cl.relrowsecurity);
  results := array_append(results, case when v_n = 1 then format('%s PASS (row level security is on)', v_i)
                                        else format('%s FAIL (row level security is off)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c where c.conrelid = 'public.user_passes'::regclass and c.contype = 'f' and c.confdeltype = 'c');
  results := array_append(results, case when v_n = 1 then format('%s PASS (passes go with the account)', v_i)
                                        else format('%s FAIL (no cascade)', v_i) end);

  -- The cap: 50 passes, then no more.
  insert into public.user_passes (user_id, kind, label) select v_b, 'other', 'Other' from generate_series(1, 50);
  v_i := v_i + 1;
  begin
    insert into public.user_passes (user_id, kind, label) values (v_b, 'other', 'One too many');
    results := array_append(results, format('%s FAIL (a 51st pass was saved)', v_i));
  exception
    when raise_exception then results := array_append(results, format('%s PASS (a 51st pass refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Signed out sees nothing and can do nothing.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.user_passes up where up.user_id in (v_a, v_b));
    results := array_append(results, format('%s FAIL (anon read user_passes)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot read passes)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Corners with something real in a city.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  v_n := (select count(*) from public.corners_with_activity('Tastecheckville', 14) r where r.corner_key like 'taste-check/%');
  results := array_append(results, case when v_n = 2 then format('%s PASS (2 fixture Corners have something real near Tastecheckville)', v_i)
                                        else format('%s FAIL (%s Corners)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select r.events from public.corners_with_activity('tastecheckville ', 14) r where r.corner_key = 'taste-check/corner-a');
  results := array_append(results, case when v_n = 1 then format('%s PASS (Corner A counts exactly 1 event: not the cancelled, far, past, closed-Space or other-city ones; the city matches ignoring case and spaces)', v_i)
                                        else format('%s FAIL (Corner A events %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select r.pursuits from public.corners_with_activity('Tastecheckville', 14) r where r.corner_key = 'taste-check/corner-b');
  results := array_append(results, case when v_n = 1 then format('%s PASS (Corner B counts 1 open Pursuit with room)', v_i)
                                        else format('%s FAIL (Corner B pursuits %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.corners_with_activity('Tastecheckville', 14) r where r.corner_key in ('taste-check/corner-c', 'taste-check/corner-d', 'taste-check/corner-e'));
  results := array_append(results, case when v_n = 0 then format('%s PASS (a full Pursuit, a friends Pursuit and one in a closed Space do not count)', v_i)
                                        else format('%s FAIL (%s counted)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.corners_with_activity('Tastecheckville', 1) r where r.corner_key = 'taste-check/corner-a');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a 1 day window does not reach an event 3 days away)', v_i)
                                        else format('%s FAIL (counted)', v_i) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.corners_with_activity('Nowhere at all', 14) r where r.corner_key like 'taste-check/%');
  results := array_append(results, case when v_n = 0 then format('%s PASS (another city gets none of them)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.corners_with_activity(null, 14) r where r.corner_key like 'taste-check/%')
       + (select count(*) from public.corners_with_activity('   ', 14) r where r.corner_key like 'taste-check/%');
  results := array_append(results, case when v_n = 0 then format('%s PASS (no city, no answer)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);

  -- The Corner of a friend's Pursuit invite.
  v_i := v_i + 1;
  v_text := (select r.hobby_slug || '/' || r.sub_hobby from public.pursuit_invite_corner('taste-check-token') r);
  results := array_append(results, case when v_text = 'taste-check/corner-b' then format('%s PASS (an invite link gives its Pursuit''s Corner)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_text) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuit_invite_corner('taste-check-revoked') r)
       + (select count(*) from public.pursuit_invite_corner('no-such-token') r);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a revoked or unknown link gives nothing)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);

  -- Signed out cannot ask either.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.corners_with_activity('Tastecheckville', 14) r);
    results := array_append(results, format('%s FAIL (anon ran corners_with_activity)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot ask for Corners with activity)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.pursuit_invite_corner('taste-check-token') r);
    results := array_append(results, format('%s FAIL (anon ran pursuit_invite_corner)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot ask for an invite''s Corner)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
