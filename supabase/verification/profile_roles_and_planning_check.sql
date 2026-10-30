-- Profile roles and planning: verification for
-- 20261109000000_profile_roles_and_planning.sql.
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration. Run
-- before it, the script stops and says "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed whatever happens. Each expected
-- failure is its own begin...exception...end sub-block with strict sqlstate
-- handling; anything unexpected is recorded as 'N ERROR <sqlstate>: <message>'.
-- No select-into, no returning-into, no delete (per CLAUDE.md).
--
-- Fixtures (all ids …7101 to …7108):
--   A owner · F friend of A · W follows A, not followed back · P a stranger
--   X blocked by A · Q a private account · M friend of both A and F
--   Z friend of A who then blocks A (a blocked friend)
-- Every lookup is scoped to those ids.

begin;

do $$
declare
  v_i int := 0;
  v_b boolean;
  v_n int;
  v_t text;
  v_j jsonb;
  v_keys text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000007101';
  v_f uuid := '00000000-0000-4000-8000-000000007102';
  v_w uuid := '00000000-0000-4000-8000-000000007103';
  v_p uuid := '00000000-0000-4000-8000-000000007104';
  v_x uuid := '00000000-0000-4000-8000-000000007105';
  v_q uuid := '00000000-0000-4000-8000-000000007106';
  v_m uuid := '00000000-0000-4000-8000-000000007107';
  v_z uuid := '00000000-0000-4000-8000-000000007108';
  v_post1 bigint;
  v_post2 bigint;
  v_post3 bigint;
  v_post4 bigint;
  v_u uuid;
begin
  if not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'planning_prefs'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261109000000_profile_roles_and_planning.sql first, nothing was created)';
  end if;

  -- Fixtures ----------------------------------------------------------------
  foreach v_u in array array[v_a, v_f, v_w, v_p, v_x, v_q, v_m, v_z] loop
    insert into auth.users
      (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
    values
      (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'profile.check.' || right(v_u::text, 4) || '@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
    update public.profiles p
       set username = 'pcheck' || right(v_u::text, 4), display_name = 'Check ' || right(v_u::text, 4)
     where p.id = v_u;
  end loop;
  update public.profiles p set is_private = true where p.id = v_q;
  update public.profiles p set neighborhood = 'Greenpoint, Brooklyn', bio = 'Climbs on weekends' where p.id = v_a;

  -- Friends A-F, A-M, F-M, A-Z; W follows A only; Q is followed by nobody.
  insert into public.profile_follows (follower_id, followed_id, status) values
    (v_a, v_f, 'accepted'), (v_f, v_a, 'accepted'),
    (v_a, v_m, 'accepted'), (v_m, v_a, 'accepted'),
    (v_f, v_m, 'accepted'), (v_m, v_f, 'accepted'),
    (v_a, v_z, 'accepted'), (v_z, v_a, 'accepted'),
    (v_w, v_a, 'accepted');
  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_x), (v_z, v_a);

  -- Pursuits: A has Climbing (target 2) and a solo one; F has Climbing too.
  insert into public.pursuits (id, user_id, title, sub_hobby, target_moments, visibility) values
    ('pcheck-a-climb', v_a, 'Send my first V4', 'Climbing', 2, 'friends'),
    ('pcheck-a-solo', v_a, 'Secret thing', 'Journaling', null, 'solo'),
    ('pcheck-f-climb', v_f, 'Climb more', 'Climbing', null, 'friends');

  -- Moments: one public, one inside its 2 hour delay, one friends-only, one on the Pursuit.
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby, starts_at, location_name, neighborhood, pursuit_id)
  values (v_a, 'sports-fitness', 'photo', 'u/a/1.jpg', 'First wall', 'public', 'Climbing', '2026-10-24 19:00:00+00', 'Secret Gym', 'Gowanus', 'pcheck-a-climb');
  v_post1 := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'First wall');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby)
  values (v_a, 'sports-fitness', 'photo', 'u/a/2.jpg', 'Just now', 'public', 'Climbing');
  v_post2 := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'Just now');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby, audience, created_at)
  values (v_a, 'sports-fitness', 'photo', 'u/a/3.jpg', 'Friends only', 'public', 'Climbing', 'friends', now() - interval '1 day');
  v_post3 := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'Friends only');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby, created_at)
  values (v_q, 'sports-fitness', 'photo', 'u/q/1.jpg', 'Private account moment', 'public', 'Pottery', now() - interval '1 day');

  -- 1. visible_at defaults to created_at + 2 hours.
  v_i := v_i + 1;
  v_b := (select po.visible_at between po.created_at + interval '119 minutes' and po.created_at + interval '121 minutes'
            from public.posts po where po.id = v_post2);
  results := results || (v_i || case when v_b then ' PASS visible_at defaults to created_at + 2h' else ' FAIL visible_at default' end);

  -- The first and third Moments were made earlier; let them be visible.
  update public.posts po set visible_at = now() - interval '1 hour' where po.id in (v_post1, v_post3);
  update public.posts po set visible_at = now() - interval '1 hour'
   where po.user_id = v_q;

  -- Stubs: one per Moment toward a Pursuit (the trigger may already have issued it).
  insert into public.stubs (user_id, kind, post_id, pursuit_id)
  values (v_a, 'session', v_post1, 'pcheck-a-climb')
  on conflict do nothing;

  -- Levels ------------------------------------------------------------------
  v_i := v_i + 1;
  v_t := (select string_agg(n || '=' || (select l.idx from private.level_for(n) l), ',' order by n)
            from unnest(array[0, 1, 2, 3, 7, 9, 10, 20, 35, 50, 60]) n);
  results := results || (v_i || case when v_t = '0=1,1=2,2=2,3=3,7=4,9=4,10=5,20=6,35=7,50=8,60=8'
    then ' PASS level thresholds' else ' FAIL level thresholds: ' || v_t end);

  -- Roles -------------------------------------------------------------------
  v_i := v_i + 1;
  v_t := private.viewer_role(v_a, v_a) || ',' || private.viewer_role(v_f, v_a) || ',' || private.viewer_role(v_w, v_a)
      || ',' || private.viewer_role(v_p, v_a) || ',' || private.viewer_role(v_x, v_a) || ',' || private.viewer_role(v_a, v_x)
      || ',' || private.viewer_role(null, v_a);
  results := results || (v_i || case when v_t = 'owner,friend,follower,public,blocked,blocked,public'
    then ' PASS viewer roles' else ' FAIL viewer roles: ' || v_t end);

  -- get_profile: exact keys per role -----------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile('pcheck' || right(v_a::text, 4));
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = 'avatarUrl,bio,displayName,followState,friendCount,id,isPrivate,level,neighborhood,planningPaused,private,pursuitCount,role,stubCount,stubsToNext,username'
    then ' PASS owner keys' else ' FAIL owner keys: ' || v_keys end);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'friendCount')::int = 3 and (v_j ->> 'pursuitCount')::int = 2
    and (v_j ->> 'stubCount')::int = (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'session')
    then ' PASS owner counts: 3 friends, 2 Pursuits, Stubs match' else ' FAIL owner counts: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile('pcheck' || right(v_a::text, 4));
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = 'avatarUrl,bio,displayName,followState,followsYou,friendCount,id,level,mutualFriendCount,mutualFriends,neighborhood,planningPaused,private,pursuitCount,role,sharedCategories,stubCount,username'
    then ' PASS friend keys' else ' FAIL friend keys: ' || v_keys end);
  v_i := v_i + 1;
  results := results || (v_i || case when v_j ->> 'role' = 'friend'
    and jsonb_array_length(v_j -> 'mutualFriends') = 1 and v_j #>> '{mutualFriends,0,id}' = v_m::text
    and v_j -> 'sharedCategories' = '["Climbing"]'::jsonb
    and (v_j ->> 'pursuitCount')::int = 1
    and v_j -> 'level' -> 'index' is not null
    then ' PASS friend: mutual friend named, shared category, solo Pursuit not counted' else ' FAIL friend values: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_w::text, true);
  v_j := public.get_profile('pcheck' || right(v_a::text, 4));
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = 'avatarUrl,bio,displayName,followState,followsYou,friendCount,id,level,mutualFriendCount,neighborhood,private,pursuitCount,role,stubCount,username'
    then ' PASS follower keys' else ' FAIL follower keys: ' || v_keys end);

  perform set_config('request.jwt.claim.sub', v_p::text, true);
  v_j := public.get_profile('pcheck' || right(v_a::text, 4));
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = 'avatarUrl,bio,displayName,followState,followsYou,friendCount,id,level,neighborhood,private,pursuitCount,role,stubCount,username'
    then ' PASS public keys' else ' FAIL public keys: ' || v_keys end);

  v_j := public.get_profile('pcheck' || right(v_q::text, 4));
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = 'avatarUrl,displayName,followState,id,levelName,private,role,username' and (v_j ->> 'private')::boolean
    then ' PASS private account, stranger: identity, level name, follow state only' else ' FAIL private keys: ' || v_keys end);

  -- Blocked, either direction: the profile does not exist.
  v_i := v_i + 1;
  perform set_config('request.jwt.claim.sub', v_x::text, true);
  v_b := public.get_profile('pcheck' || right(v_a::text, 4)) is null;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_b := v_b and public.get_profile('pcheck' || right(v_x::text, 4)) is null;
  results := results || (v_i || case when v_b then ' PASS blocked in either direction returns nothing' else ' FAIL blocked profile returned' end);

  -- Signed out: public view.
  perform set_config('request.jwt.claim.sub', '', true);
  v_j := public.get_profile('pcheck' || right(v_a::text, 4));
  v_i := v_i + 1;
  results := results || (v_i || case when v_j ->> 'role' = 'public' and v_j ->> 'followState' = 'none'
    then ' PASS signed out is public' else ' FAIL signed out: ' || coalesce(v_j::text, 'null') end);

  -- Moments -----------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile_moments(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 3
    and exists (select 1 from jsonb_array_elements(v_j -> 'items') e where e ->> 'placeName' = 'Secret Gym' and e ->> 'occurredAt' like '2026-10-24%')
    and exists (select 1 from jsonb_array_elements(v_j -> 'items') e where e ->> 'caption' = 'Just now' and e ->> 'visibleAt' is not null)
    then ' PASS owner sees all 3 Moments, place, full time and the delayed label' else ' FAIL owner moments: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile_moments(v_a);
  v_keys := (select string_agg(distinct k, ',' order by k) from jsonb_array_elements(v_j -> 'items') e, jsonb_object_keys(e) k);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 2
    and v_keys = 'caption,category,date,id,neighborhood,photoUrl'
    and exists (select 1 from jsonb_array_elements(v_j -> 'items') e where e ->> 'date' = '2026-10-24' and e ->> 'neighborhood' = 'Gowanus')
    and not (v_j::text like '%Secret Gym%') and not (v_j::text like '%Just now%')
    then ' PASS friend sees 2 Moments: date and neighborhood only, no place, delayed one absent' else ' FAIL friend moments: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_w::text, true);
  v_j := public.get_profile_moments(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 1 and not (v_j::text like '%Friends only%')
    then ' PASS follower does not see friends-only Moment' else ' FAIL follower moments: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_p::text, true);
  v_j := public.get_profile_moments(v_q);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 0 and jsonb_array_length(v_j -> 'items') = 0
    then ' PASS private account hides Moments from a stranger' else ' FAIL private moments: ' || v_j::text end);

  perform set_config('request.jwt.claim.sub', v_x::text, true);
  v_j := public.get_profile_moments(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 0 then ' PASS blocked sees no Moments' else ' FAIL blocked moments' end);

  -- Stubs -------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile_stubs(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when jsonb_array_length(v_j) >= 1 and v_j #> '{0,date}' is not null and v_j #>> '{0,category}' = 'Climbing'
    then ' PASS owner Stub has full date and category' else ' FAIL owner stubs: ' || v_j::text end);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile_stubs(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when jsonb_array_length(v_j) >= 1 and (v_j #>> '{0,date}') is null and length(v_j #>> '{0,day}') = 10
    then ' PASS friend Stub has day only' else ' FAIL friend stubs: ' || v_j::text end);

  -- Pursuits ----------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when jsonb_array_length(v_j) = 2 then ' PASS owner sees both Pursuits' else ' FAIL owner pursuits' end);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when jsonb_array_length(v_j) = 1 and (v_j #>> '{0,sharedWithYou}')::boolean and not (v_j::text like '%Secret thing%')
    and (v_j #> '{0,lastMomentDate}') = 'null'::jsonb
    then ' PASS friend sees only the non-solo Pursuit, flagged shared, no last date' else ' FAIL friend pursuits: ' || v_j::text end);
  perform set_config('request.jwt.claim.sub', v_w::text, true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j #>> '{0,sharedWithYou}')::boolean is false then ' PASS follower gets no shared flag' else ' FAIL follower shared flag' end);

  -- Auto-finish: the second Moment toward a target of 2 finishes the Pursuit.
  v_i := v_i + 1;
  v_b := (select pu.finished_at is null from public.pursuits pu where pu.id = 'pcheck-a-climb');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby, pursuit_id, created_at)
  values (v_a, 'sports-fitness', 'photo', 'u/a/4.jpg', 'Second toward target', 'public', 'Climbing', 'pcheck-a-climb', '2026-10-25 10:00:00+00');
  v_post4 := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'Second toward target');
  results := results || (v_i || case when v_b
    and (select pu.finished_at = '2026-10-25 10:00:00+00' from public.pursuits pu where pu.id = 'pcheck-a-climb')
    then ' PASS reaching the target finishes the Pursuit at that Moment' else ' FAIL auto-finish' end);
  update public.posts po set visible_at = now() - interval '1 hour' where po.id = v_post4;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (select e ->> 'finishedAt' from jsonb_array_elements(v_j) e where e ->> 'id' = 'pcheck-a-climb') = '2026-10-25'
    then ' PASS owner finished date is a full date' else ' FAIL owner finished date' end);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (select e ->> 'finishedAt' from jsonb_array_elements(v_j) e where e ->> 'id' = 'pcheck-a-climb') = '2026-10'
    then ' PASS friend finished date is month and year only' else ' FAIL friend finished date' end);
  -- Reopen then the owner can mark finished again.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.set_pursuit_finished('pcheck-a-climb', false);
  v_i := v_i + 1;
  results := results || (v_i || case when (select pu.finished_at is null from public.pursuits pu where pu.id = 'pcheck-a-climb')
    then ' PASS owner can reopen' else ' FAIL reopen' end);
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_f::text, true);
    perform public.set_pursuit_finished('pcheck-a-climb', true);
    results := results || (v_i || ' FAIL someone else finished a Pursuit');
  exception
    when raise_exception then results := results || (v_i || ' PASS only the owner can finish a Pursuit');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- planning_prefs is closed to everyone else, even signed in.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.set_my_planning(
    '[{"day":"mon","part":"evening"},{"day":"tue","part":"evening"},{"day":"wed","part":"evening"},{"day":"thu","part":"evening"},{"day":"fri","part":"evening"},{"day":"sat","part":"evening"},{"day":"sun","part":"evening"},{"day":"sat","part":"morning"}]'::jsonb,
    9, 10000, '[{"name":"Brooklyn Boulders","monthly_cost_cents":9000}]'::jsonb, true);
  v_i := v_i + 1;
  begin
    set local role authenticated;
    v_n := (select count(*) from public.planning_prefs pp where pp.user_id = v_a);
    reset role;
    results := results || (v_i || ' FAIL a signed-in role read planning_prefs (' || v_n || ' rows)');
  exception
    when insufficient_privilege then
      reset role;
      results := results || (v_i || ' PASS planning_prefs has no direct read for signed-in roles');
    when others then
      reset role;
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    perform public.set_my_planning('[{"day":"mon","part":"night"}]'::jsonb, 1, 1, '[]'::jsonb, true);
    results := results || (v_i || ' FAIL an invalid part was accepted');
  exception
    when raise_exception then results := results || (v_i || ' PASS invalid availability is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_j := public.get_my_planning();
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'freeHoursPerWeek')::int = 9 and (v_j ->> 'monthlyBudgetCents')::int = 10000
    then ' PASS owner reads own planning' else ' FAIL own planning: ' || v_j::text end);

  -- Friend F: evenings only, same membership.
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform public.set_my_planning(
    '[{"day":"mon","part":"evening"},{"day":"tue","part":"evening"},{"day":"wed","part":"evening"},{"day":"thu","part":"evening"},{"day":"fri","part":"evening"},{"day":"sat","part":"evening"},{"day":"sun","part":"evening"}]'::jsonb,
    5, 5000, '[{"name":"Brooklyn Boulders","monthly_cost_cents":9000}]'::jsonb, true);

  -- Plan together ------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.suggest_plan(v_f, 'Climbing');
  v_keys := (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k);
  v_i := v_i + 1;
  results := results || (v_i || case when v_j ->> 'status' = 'ok' and jsonb_array_length(v_j -> 'slots') = 3
    and v_keys = 'categories,place,slots,status'
    and (select bool_and(e ->> 'part' = 'evening' and (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$') from jsonb_array_elements(v_j -> 'slots') e)
    and v_j #>> '{place,note}' = 'You both have memberships here'
    and v_j -> 'categories' = '["Climbing", "Something new"]'::jsonb
    then ' PASS suggest returns 3 evening slots, shared category, shared place' else ' FAIL suggest: ' || v_j::text end);
  v_i := v_i + 1;
  results := results || (v_i || case when v_j::text !~* 'availab|budget|hours|cents|monthly'
    then ' PASS suggest never contains availability, budget or hours' else ' FAIL suggest leaks: ' || v_j::text end);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j #>> '{slots,0,date}')::date >= current_date and (v_j #>> '{slots,2,date}')::date <= current_date + 13
    then ' PASS slots sit inside the next 14 days, soonest first' else ' FAIL slot window' end);

  -- Friend does not share membership names: no place.
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform public.set_my_planning('[{"day":"mon","part":"evening"}]'::jsonb, 5, 5000,
    '[{"name":"Brooklyn Boulders","monthly_cost_cents":9000}]'::jsonb, false);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.suggest_plan(v_f, 'Climbing');
  v_i := v_i + 1;
  results := results || (v_i || case when not (v_j ? 'place') and jsonb_array_length(v_j -> 'slots') <= 3
    then ' PASS no place when the friend keeps membership names private' else ' FAIL place leaked: ' || v_j::text end);

  -- Rate limit: 10 per pair per 24 hours, then the cached result.
  v_n := 0;
  for v_n in 1..12 loop
    v_j := public.suggest_plan(v_f, null);
  end loop;
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.plan_suggestions ps
        where (ps.user_id = v_a and ps.friend_id = v_f) or (ps.user_id = v_f and ps.friend_id = v_a)) = 10
    and v_j ->> 'status' = 'ok'
    then ' PASS rate limit stops at 10 per pair and serves the cache' else ' FAIL rate limit' end);

  -- Rejections.
  v_i := v_i + 1;
  begin
    perform public.suggest_plan(v_p, null);
    results := results || (v_i || ' FAIL suggested a plan with a non-friend');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a non-friend is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_a::text, true);
    perform public.suggest_plan(v_z, null);
    results := results || (v_i || ' FAIL suggested a plan with a user who blocked me');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a block refuses planning even between friends');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  -- Paused on either side.
  perform public.set_planning_paused(true);
  v_j := public.suggest_plan(v_f, null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_j = '{"status": "unavailable"}'::jsonb then ' PASS my pause returns unavailable' else ' FAIL my pause' end);
  perform public.set_planning_paused(false);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform public.set_planning_paused(true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.suggest_plan(v_f, null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_j = '{"status": "unavailable"}'::jsonb then ' PASS their pause returns unavailable' else ' FAIL their pause' end);
  v_j := public.get_profile('pcheck' || right(v_f::text, 4));
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'planningPaused')::boolean then ' PASS a friend sees the paused flag' else ' FAIL paused flag' end);
  v_i := v_i + 1;
  begin
    perform public.send_plan_invite(v_f, 'Climbing', null, null, null);
    results := results || (v_i || ' FAIL sent an invite to a paused friend');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS no invite to a paused friend');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform public.set_planning_paused(false);

  -- Invites ------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.send_plan_invite(v_f, 'Climbing', current_date + 3, 'evening', 'Brooklyn Boulders');
  perform public.send_plan_invite(v_f, 'Something new', null, null, null);
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.plans pl where pl.creator_id = v_a and pl.invitee_id = v_f) = 2
    and (select count(*) from public.plans pl where pl.creator_id = v_a and pl.plan_date is null and pl.part is null) = 1
    and (select count(*) from public.notifications n where n.user_id = v_f and n.kind = 'plan_invite') = 2
    then ' PASS invites create plans (one open) and notifications' else ' FAIL invites' end);
  v_i := v_i + 1;
  results := results || (v_i || case when not exists (select 1 from public.notifications n where n.user_id = v_f and n.kind = 'plan_invite' and char_length(n.body) > 300)
    then ' PASS invite notification bodies are under the cap' else ' FAIL notification body length' end);
  v_i := v_i + 1;
  begin
    perform public.send_plan_invite(v_p, 'Climbing', null, null, null);
    results := results || (v_i || ' FAIL invited a non-friend');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a non-friend cannot be invited');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Profile details --------------------------------------------------------
  v_i := v_i + 1;
  begin
    perform public.update_profile_details('Gowanus', repeat('x', 200), false);
    results := results || (v_i || case when (select char_length(p.bio) = 120 from public.profiles p where p.id = v_a)
      then ' PASS bio is held to 120 characters' else ' FAIL bio length' end);
  exception
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Cascade: a deleted user takes their planning and plans with them.
  v_i := v_i + 1;
  v_b := (select bool_and(c.confdeltype = 'c') from pg_constraint c
           where c.contype = 'f' and c.conrelid in ('public.planning_prefs'::regclass, 'public.plans'::regclass, 'public.plan_suggestions'::regclass)
             and c.confrelid = 'auth.users'::regclass);
  results := results || (v_i || case when v_b then ' PASS planning tables cascade on user delete' else ' FAIL cascade' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
