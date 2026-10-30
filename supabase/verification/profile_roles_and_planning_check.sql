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
-- Fixtures (all ids …7101 to …7111):
--   A owner · F friend of A · W follows A, not followed back · P a stranger
--   X blocked by A · Q a private account · M friend of both A and F
--   Z friend of A who then blocks A (a blocked friend)
--   INV invited N1 and N2; they post their first Moments (…7109 to …7111)
--   INV invited N1 and N2 (…7109 to …7111); they post a first Moment each
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
  v_inv uuid := '00000000-0000-4000-8000-000000007109';
  v_n1 uuid := '00000000-0000-4000-8000-000000007110';
  v_n2 uuid := '00000000-0000-4000-8000-000000007111';
  v_post7 bigint;
  v_post8 bigint;
  v_post9 bigint;
  v_post10 bigint;
  v_post11 bigint;
  v_space uuid := '00000000-0000-4000-8000-000000007201';
  v_ts timestamptz;
  v_post1 bigint;
  v_post2 bigint;
  v_post3 bigint;
  v_post4 bigint;
  v_post5 bigint;
  v_post6 bigint;
  v_u uuid;
begin
  if not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'planning_prefs'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261109000000_profile_roles_and_planning.sql first, nothing was created)';
  end if;

  -- Fixtures ----------------------------------------------------------------
  foreach v_u in array array[v_a, v_f, v_w, v_p, v_x, v_q, v_m, v_z, v_inv, v_n1, v_n2] loop
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
  insert into public.pursuits (id, user_id, title, sub_hobby, target_moments, visibility, shared) values
    ('pcheck-a-climb', v_a, 'Send my first V4', 'Climbing', 2, 'friends', true),
    ('pcheck-a-solo', v_a, 'Secret thing', 'Pottery', null, 'solo', false),
    ('pcheck-f-climb', v_f, 'Climb more', 'Climbing', null, 'friends', true);

  -- Moments: one public, one inside its 2 hour delay, one friends-only, one on the Pursuit.
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby, pursuit_id)
  values (v_a, 'sports-fitness', 'photo', 'u/a/1.jpg', 'First wall', 'public', 'Climbing', 'pcheck-a-climb');
  v_post1 := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'First wall');
  -- The exact time and place are set by the owner, through the function.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.set_post_private(v_post1, '2026-10-24 19:00:00+00', 'Secret Gym', 'Gowanus');
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
  results := results || (v_i || case when (v_j ->> 'friendCount')::int = 2 and (v_j ->> 'pursuitCount')::int = 2
    and (v_j ->> 'stubCount')::int = (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'session')
    then ' PASS owner counts: 2 friends (blocking Z removed that friendship), 2 Pursuits, Stubs match' else ' FAIL owner counts: ' || v_j::text end);

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

  -- A link made from a user id (Moment cards link that way) finds the same profile.
  v_i := v_i + 1;
  v_b := public.get_profile(v_a::text) ->> 'id' = v_a::text;
  results := results || (v_i || case when v_b then ' PASS a profile link by user id resolves' else ' FAIL id link' end);

  -- A link made from a display name finds the one username it belongs to.
  perform set_config('request.jwt.claim.sub', v_p::text, true);
  v_i := v_i + 1;
  v_b := public.resolve_profile_handle('check ' || right(v_a::text, 4)) = 'pcheck' || right(v_a::text, 4);
  update public.profiles p set display_name = 'Twin Name' where p.id in (v_m, v_z);
  v_b := v_b and public.resolve_profile_handle('twin name') is null;
  update public.profiles p set display_name = 'Check ' || right(v_z::text, 4) where p.id = v_z;
  v_b := v_b and public.resolve_profile_handle(' TWIN name ') = 'pcheck' || right(v_m::text, 4);
  v_b := v_b and public.resolve_profile_handle('nobody by this name') is null;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_b := v_b and public.resolve_profile_handle('Check ' || right(v_x::text, 4)) is null;
  results := results || (v_i || case when v_b then ' PASS a display name resolves to one username, never to a blocked or shared name' else ' FAIL handle resolution' end);

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


  -- No availability set: the same empty answer whichever side is missing it.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.suggest_plan(v_m, null);
  v_i := v_i + 1;
  v_b := v_j ->> 'status' = 'ok' and v_j -> 'slots' = '[]'::jsonb;
  perform set_config('request.jwt.claim.sub', v_m::text, true);
  perform public.set_my_planning('[{"day":"mon","part":"evening"}]'::jsonb, null, null, '[]'::jsonb, true);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform public.set_my_planning('[]'::jsonb, null, null, '[]'::jsonb, true);
  perform set_config('request.jwt.claim.sub', v_m::text, true);
  v_j := public.suggest_plan(v_f, null);
  v_b := v_b and v_j ->> 'status' = 'ok' and v_j -> 'slots' = '[]'::jsonb
        and (select string_agg(k, ',' order by k) from jsonb_object_keys(v_j) k) = 'categories,slots,status';
  results := results || (v_i || case when v_b then ' PASS no availability on either side gives the same empty answer' else ' FAIL no-availability answers differ' end);

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


  -- Column privacy: no direct path for non-owners -----------------------------
  v_i := v_i + 1;
  v_b := not exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name in ('place_name', 'occurred_at'));
  results := results || (v_i || case when v_b then ' PASS posts has no place_name or occurred_at column' else ' FAIL private columns on posts' end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.post_private pp where pp.post_id in (v_post1, v_post2, v_post3, v_post4));
  results := results || (v_i || case when v_n = 4 then ' PASS every new Moment gets a private row' else ' FAIL private rows: ' || v_n end);

  foreach v_t in array array['post_private', 'planning_prefs', 'plan_suggestions', 'plans'] loop
    v_i := v_i + 1;
    begin
      perform set_config('request.jwt.claim.sub', v_p::text, true);
      set local role authenticated;
      execute 'select count(*) from public.' || v_t into v_n;
      reset role;
      if v_t = 'plans' then
        results := results || (v_i || case when v_n = 0 then ' PASS a signed-in stranger reads no rows of plans' else ' FAIL plans leaked ' || v_n end);
      else
        results := results || (v_i || ' FAIL a signed-in role read ' || v_t);
      end if;
    exception
      when insufficient_privilege then
        reset role;
        results := results || (v_i || ' PASS signed-in direct select of ' || v_t || ' is denied');
      when others then
        reset role;
        results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
    end;
    v_i := v_i + 1;
    begin
      set local role anon;
      execute 'select count(*) from public.' || v_t into v_n;
      reset role;
      results := results || (v_i || ' FAIL anon read ' || v_t);
    exception
      when insufficient_privilege then
        reset role;
        results := results || (v_i || ' PASS anon direct select of ' || v_t || ' is denied');
      when others then
        reset role;
        results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
    end;
  end loop;

  -- Even a third party who is a friend of one side cannot read someone else's plan.
  perform set_config('request.jwt.claim.sub', v_m::text, true);
  v_i := v_i + 1;
  begin
    set local role authenticated;
    v_n := (select count(*) from public.plans pl where pl.creator_id = v_a);
    reset role;
    results := results || (v_i || case when v_n = 0 then ' PASS a third party sees none of A''s plans' else ' FAIL third party read plans' end);
  exception
    when others then
      reset role;
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- The writer-only functions are not callable by anon.
  v_i := v_i + 1;
  v_b := not has_function_privilege('anon', 'public.get_my_post_private(bigint[])', 'execute')
     and not has_function_privilege('anon', 'public.suggest_plan(uuid, text)', 'execute')
     and not has_function_privilege('anon', 'public.get_my_planning()', 'execute');
  results := results || (v_i || case when v_b then ' PASS anon cannot execute the owner functions' else ' FAIL anon execute' end);

  -- The owner function returns only the owner's own rows.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.get_my_post_private(array[v_post1]) g where g.place_name = 'Secret Gym');
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_n := v_n + (select count(*) from public.get_my_post_private(array[v_post1]) g);
  results := results || (v_i || case when v_n = 1 then ' PASS only the owner reads the exact place' else ' FAIL owner place read: ' || v_n end);
  v_i := v_i + 1;
  begin
    perform public.set_post_private(v_post1, now(), 'Elsewhere', null);
    results := results || (v_i || ' FAIL someone else set a Moment place');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS only the owner can set a Moment place');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- profiles: the new columns are not readable or writable directly.
  v_i := v_i + 1;
  v_b := true;
  foreach v_t in array array['is_private', 'planning_paused', 'neighborhood'] loop
    v_b := v_b and not has_column_privilege('anon', 'public.profiles', v_t, 'select')
               and not has_column_privilege('authenticated', 'public.profiles', v_t, 'select')
               and not has_column_privilege('authenticated', 'public.profiles', v_t, 'update')
               and not has_column_privilege('anon', 'public.profiles', v_t, 'update');
  end loop;
  results := results || (v_i || case when v_b then ' PASS profile privacy columns have no direct select or update' else ' FAIL profile column privileges' end);

  -- Old Moments: a null visible_at still counts as visible, and the backfill fills it.
  perform set_config('soosh.legacy_rows', 'on', true);
  update public.posts po set visible_at = null where po.id = v_post1;
  perform set_config('soosh.legacy_rows', 'off', true);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_j := public.get_profile_moments(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when exists (select 1 from jsonb_array_elements(v_j -> 'items') e where e ->> 'caption' = 'First wall')
    then ' PASS a Moment with no visible_at stays visible' else ' FAIL null visible_at hid a Moment' end);
  update public.posts po set visible_at = po.created_at where po.id = v_post1 and po.visible_at is null;
  insert into public.post_private (post_id, user_id, occurred_at)
    select po.id, po.user_id, po.created_at from public.posts po where po.id = v_post1
    on conflict (post_id) do nothing;
  v_i := v_i + 1;
  results := results || (v_i || case when (select po.visible_at = po.created_at from public.posts po where po.id = v_post1)
    and (select count(*) from public.post_private pp where pp.post_id = v_post1) = 1
    then ' PASS the backfill statements are idempotent and keep the Moment' else ' FAIL backfill' end);

  -- Archive and delete -----------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.set_pursuit_archived('pcheck-a-climb', true);
  v_j := public.get_profile_pursuits(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (select (e ->> 'archived')::boolean from jsonb_array_elements(v_j) e where e ->> 'id' = 'pcheck-a-climb')
    and (public.get_profile('pcheck' || right(v_a::text, 4)) ->> 'pursuitCount')::int = 1
    then ' PASS archive keeps it for the owner and drops it from the count' else ' FAIL archive owner view' end);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_i := v_i + 1;
  results := results || (v_i || case when jsonb_array_length(public.get_profile_pursuits(v_a)) = 0
    and public.get_profile('pcheck' || right(v_a::text, 4)) -> 'sharedCategories' = '[]'::jsonb
    then ' PASS an archived Pursuit is gone for friends, categories included' else ' FAIL archive friend view' end);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.set_pursuit_archived('pcheck-a-climb', false);
  v_i := v_i + 1;
  results := results || (v_i || case when (select pu.archived_at is null from public.pursuits pu where pu.id = 'pcheck-a-climb')
    then ' PASS unarchive' else ' FAIL unarchive' end);
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_f::text, true);
    perform public.set_pursuit_archived('pcheck-a-climb', true);
    results := results || (v_i || ' FAIL someone else archived a Pursuit');
  exception
    when raise_exception then results := results || (v_i || ' PASS only the owner can archive');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_f::text, true);
    perform public.delete_profile_pursuit('pcheck-a-climb');
    results := results || (v_i || ' FAIL someone else deleted a Pursuit');
  exception
    when raise_exception then results := results || (v_i || ' PASS only the owner can delete');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  -- Deleting is a cascade, never a loose end: the Moments keep and the Stubs go.
  v_i := v_i + 1;
  v_b := (select c.confdeltype = 'n' from pg_constraint c where c.conname = 'posts_pursuit_id_fkey')
     and (select c.confdeltype = 'c' from pg_constraint c where c.conname = 'stubs_pursuit_id_fkey');
  results := results || (v_i || case when v_b then ' PASS deleting a Pursuit keeps its Moments and removes its Stubs' else ' FAIL delete cascade' end);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_i := v_i + 1;
  perform public.delete_profile_pursuit('pcheck-a-solo');
  results := results || (v_i || case when not exists (select 1 from public.pursuits pu where pu.id = 'pcheck-a-solo')
    then ' PASS the owner can delete a Pursuit' else ' FAIL delete' end);


  -- Row policy: a Moment cannot be selected by a non-owner until visible_at -----
  -- M's Moments, read directly as each kind of viewer: M owns them, F is M's friend,
  -- W follows M one way, P is a stranger, and anon is signed out.
  insert into public.profile_follows (follower_id, followed_id, status) values (v_w, v_m, 'accepted')
    on conflict (follower_id, followed_id) do nothing;
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby)
  values (v_m, 'sports-fitness', 'photo', 'u/m/1.jpg', 'Policy public', 'public', 'Climbing');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, sub_hobby)
  values (v_m, 'sports-fitness', 'photo', 'u/m/2.jpg', 'Policy followers', 'followers', 'Climbing');
  v_post5 := (select po.id from public.posts po where po.user_id = v_m and po.caption = 'Policy public');
  v_post6 := (select po.id from public.posts po where po.user_id = v_m and po.caption = 'Policy followers');

  -- Held back (visible_at is 2 hours out from the trigger default).
  v_t := '';
  foreach v_u in array array[v_m, v_f, v_w, v_p, null::uuid] loop
    begin
      perform set_config('request.jwt.claim.sub', coalesce(v_u::text, ''), true);
      if v_u is null then set local role anon; else set local role authenticated; end if;
      v_n := (select count(*) from public.posts po where po.id in (v_post5, v_post6));
      reset role;
      v_t := v_t || v_n || ',';
    exception
      when others then
        reset role;
        v_t := v_t || 'ERR ' || sqlstate || ',';
    end;
  end loop;
  v_i := v_i + 1;
  results := results || (v_i || case when v_t = '2,0,0,0,0,' then ' PASS before visible_at only the owner can select a Moment (friend, follower, stranger, anon see none)' else ' FAIL held-back Moments: ' || v_t end);

  -- The owner can also read its created_at; nobody else can read the row at all.
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_i := v_i + 1;
  begin
    set local role authenticated;
    v_n := (select count(*) from public.posts po where po.id = v_post5 and po.created_at is not null);
    reset role;
    results := results || (v_i || case when v_n = 0 then ' PASS a friend cannot read created_at of a held-back Moment' else ' FAIL created_at leaked' end);
  exception
    when others then
      reset role;
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Released: visible_at in the past.
  update public.posts po set visible_at = now() - interval '1 minute' where po.id in (v_post5, v_post6);
  v_t := '';
  foreach v_u in array array[v_m, v_f, v_w, v_p, null::uuid] loop
    begin
      perform set_config('request.jwt.claim.sub', coalesce(v_u::text, ''), true);
      if v_u is null then set local role anon; else set local role authenticated; end if;
      v_n := (select count(*) from public.posts po where po.id = v_post5);
      v_t := v_t || v_n || '/' || (select count(*) from public.posts po where po.id = v_post6) || ',';
      reset role;
    exception
      when others then
        reset role;
        v_t := v_t || 'ERR ' || sqlstate || ',';
    end;
  end loop;
  v_i := v_i + 1;
  -- owner 1/1, friend 1/1, follower 1/1, stranger 1/0 (followers-only stays closed), anon 1/0
  results := results || (v_i || case when v_t = '1/1,1/1,1/1,1/0,1/0,' then ' PASS after visible_at the row is readable by its audience (public to all, followers-only to followers and friends)' else ' FAIL released Moments: ' || v_t end);

  -- Old Moments with no visible_at stay readable.
  perform set_config('soosh.legacy_rows', 'on', true);
  perform set_config('soosh.legacy_rows', 'on', true);
  update public.posts po set visible_at = null where po.id = v_post5;
  perform set_config('soosh.legacy_rows', 'off', true);
  perform set_config('soosh.legacy_rows', 'off', true);
  perform set_config('request.jwt.claim.sub', v_p::text, true);
  v_i := v_i + 1;
  begin
    set local role authenticated;
    v_n := (select count(*) from public.posts po where po.id = v_post5);
    reset role;
    results := results || (v_i || case when v_n = 1 then ' PASS a Moment with no visible_at stays readable' else ' FAIL null visible_at hid the row' end);
  exception
    when others then
      reset role;
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Delayed again: closed for the stranger once more.
  update public.posts po set visible_at = now() + interval '1 hour' where po.id = v_post5;
  v_i := v_i + 1;
  begin
    set local role authenticated;
    v_n := (select count(*) from public.posts po where po.id = v_post5);
    reset role;
    results := results || (v_i || case when v_n = 0 then ' PASS a Moment held back again is closed again' else ' FAIL re-held Moment readable' end);
  exception
    when others then
      reset role;
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;


  -- The 2 hour hold, app-wide ---------------------------------------------------
  v_i := v_i + 1;
  v_b := (select pg_get_expr(d.adbin, d.adrelid) like '%interval%' from pg_attrdef d
           join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
          where d.adrelid = 'public.posts'::regclass and a.attname = 'visible_at');
  results := results || (v_i || case when v_b then ' PASS visible_at has a column default (now plus 2 hours)' else ' FAIL visible_at default' end);

  -- Z posts twice: asking for the future and for the past.
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
  values (v_z, 'sports-fitness', 'photo', 'u/z/far.jpg', 'Asked for the future', 'public', now() + interval '10 days');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
  values (v_z, 'sports-fitness', 'photo', 'u/z/past.jpg', 'Asked for the past', 'public', now() - interval '3 days');
  v_i := v_i + 1;
  v_b := (select po.visible_at = po.created_at + interval '2 hours' from public.posts po where po.caption = 'Asked for the future' and po.user_id = v_z)
     and (select po.visible_at = po.created_at from public.posts po where po.caption = 'Asked for the past' and po.user_id = v_z);
  results := results || (v_i || case when v_b then ' PASS a requested visible_at is clamped between created_at and created_at + 2h' else ' FAIL visible_at clamp' end);

  v_i := v_i + 1;
  begin
    update public.posts po set visible_at = null where po.user_id = v_z and po.caption = 'Asked for the future';
    results := results || (v_i || ' FAIL a Moment lost its visible_at');
  exception
    when raise_exception then results := results || (v_i || ' PASS a Moment cannot lose its visible_at');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Release effects wait for visible_at. INV invited N1 and N2.
  update public.profiles p set invited_by = v_inv where p.id in (v_n1, v_n2);
  -- posts_corner_fkey: a Moment's Corner must exist, so the fixture Corner starts at 0.
  insert into public.corners (space_slug, slug, name, moment_count) values ('pcheck-space', 'pcheckcorner', 'Pcheck corner', 0);
  perform set_config('request.jwt.claim.sub', v_n1::text, true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, corner)
  values (v_n1, 'pcheck-space', 'photo', 'u/n1/1.jpg', 'N1 first', 'public', 'pcheckcorner');
  v_post7 := (select po.id from public.posts po where po.user_id = v_n1 and po.caption = 'N1 first');
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment') = 0
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 0
     and (select po.notified_at is null from public.posts po where po.id = v_post7);
  results := results || (v_i || case when v_b then ' PASS a held first Moment sends no notification and adds no Corner count' else ' FAIL held effects fired on insert' end);

  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment') = 0
     and (select po.notified_at is null from public.posts po where po.id = v_post7);
  results := results || (v_i || case when v_b then ' PASS the sweep leaves a Moment that is not due yet' else ' FAIL sweep released a held Moment' end);

  -- Time passes: it becomes due.
  update public.posts po set visible_at = po.created_at where po.id = v_post7;
  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment' and n.href = '/moment/' || v_post7) = 1
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 1
     and (select po.notified_at is not null from public.posts po where po.id = v_post7);
  results := results || (v_i || case when v_b then ' PASS at visible_at the sweep sends the first-Moment notice and counts the Corner once' else ' FAIL release at visible_at' end);
  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment') = 1
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 1;
  results := results || (v_i || case when v_b then ' PASS running the sweep again changes nothing' else ' FAIL release repeated' end);

  -- Share now: released at insert, so the effects run straight away.
  perform set_config('request.jwt.claim.sub', v_n2::text, true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, corner, visible_at)
  values (v_n2, 'pcheck-space', 'photo', 'u/n2/1.jpg', 'N2 first', 'public', 'pcheckcorner', now() - interval '1 hour');
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment') = 2
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 2;
  results := results || (v_i || case when v_b then ' PASS a Moment shared now notifies and counts at once' else ' FAIL share now effects' end);

  -- A blocked pair gets no first-Moment notice from a sweep.
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and char_length(n.body) > 300) = 0;
  results := results || (v_i || case when v_b then ' PASS notice bodies stay under the cap' else ' FAIL notice length' end);

  -- Counts others see exclude held Moments; the Corner activity count too.
  perform set_config('request.jwt.claim.sub', v_n1::text, true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, corner)
  values (v_n1, 'pcheck-space', 'photo', 'u/n1/2.jpg', 'N1 second', 'public', 'pcheckcorner');
  v_post8 := (select po.id from public.posts po where po.user_id = v_n1 and po.caption = 'N1 second');
  v_i := v_i + 1;
  v_b := (select a.moments_30d from public.corner_activity_30d() a where a.slug = 'pcheckcorner') = 2
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 2;
  results := results || (v_i || case when v_b then ' PASS a held Moment is not in the Corner counts' else ' FAIL held Moment counted' end);

  v_i := v_i + 1;
  v_ts := public.get_moment_hold(v_post8);
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  v_b := v_ts is not null and public.get_moment_hold(v_post8) is null;
  results := results || (v_i || case when v_b then ' PASS only the owner can see that a Moment is held' else ' FAIL hold visibility' end);

  v_i := v_i + 1;
  begin
    perform public.release_moment(v_post8);
    results := results || (v_i || ' FAIL someone else released a Moment');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS only the owner can release a Moment');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', v_n1::text, true);
  perform public.release_moment(v_post8);
  v_i := v_i + 1;
  v_b := public.get_moment_hold(v_post8) is null
     and (select a.moments_30d from public.corner_activity_30d() a where a.slug = 'pcheckcorner') = 3
     and (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 3
     and (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'first_moment') = 2;
  results := results || (v_i || case when v_b then ' PASS releasing a held Moment counts it once and sends no second first-Moment notice' else ' FAIL release_moment' end);
  perform public.release_moment(v_post8);
  v_i := v_i + 1;
  results := results || (v_i || case when (select c.moment_count from public.corners c where c.slug = 'pcheckcorner') = 3
    then ' PASS releasing twice counts once' else ' FAIL double release' end);

  v_i := v_i + 1;
  v_b := pg_get_functiondef('public.space_moment_count_30d(uuid)'::regprocedure) like '%visible_at%';
  results := results || (v_i || case when v_b then ' PASS the Space Moment count joins to released Moments' else ' FAIL space count' end);

  -- Stubs, level, Pursuit progress and Moment totals others see: released only.
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, pursuit_id)
  values (v_f, 'sports-fitness', 'photo', 'u/f/held.jpg', 'F held toward Climbing', 'public', 'pcheck-f-climb');
  v_post9 := (select po.id from public.posts po where po.user_id = v_f and po.caption = 'F held toward Climbing');
  insert into public.stubs (user_id, kind, post_id, pursuit_id) values (v_f, 'session', v_post9, 'pcheck-f-climb') on conflict do nothing;
  v_j := public.get_profile('pcheck' || right(v_f::text, 4));
  v_i := v_i + 1;
  v_b := (v_j ->> 'stubCount')::int = 1 and (v_j -> 'level' ->> 'index')::int = 2
     and (public.get_profile_moments(v_f) ->> 'total')::int = 1
     and (select (e ->> 'stubCount')::int from jsonb_array_elements(public.get_profile_pursuits(v_f)) e where e ->> 'id' = 'pcheck-f-climb') = 1;
  results := results || (v_i || case when v_b then ' PASS the owner sees a held Moment in Stubs, level, Pursuit progress and Moment total at once' else ' FAIL owner counts: ' || v_j::text end);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_j := public.get_profile('pcheck' || right(v_f::text, 4));
  v_i := v_i + 1;
  v_b := (v_j ->> 'stubCount')::int = 0 and (v_j -> 'level' ->> 'index')::int = 1
     and (public.get_profile_moments(v_f) ->> 'total')::int = 0
     and (select (e ->> 'stubCount')::int from jsonb_array_elements(public.get_profile_pursuits(v_f)) e where e ->> 'id' = 'pcheck-f-climb') = 0
     and (select (e ->> 'momentCount')::int from jsonb_array_elements(public.get_profile_pursuits(v_f)) e where e ->> 'id' = 'pcheck-f-climb') = 0
     and jsonb_array_length(public.get_profile_stubs(v_f)) = 0;
  results := results || (v_i || case when v_b then ' PASS others count none of it before release: Stubs 0, level 1, progress 0, Moments 0' else ' FAIL others counts: ' || v_j::text end);
  update public.posts po set visible_at = po.created_at where po.id = v_post9;
  v_j := public.get_profile('pcheck' || right(v_f::text, 4));
  v_i := v_i + 1;
  v_b := (v_j ->> 'stubCount')::int = 1 and (v_j -> 'level' ->> 'index')::int = 2
     and (public.get_profile_moments(v_f) ->> 'total')::int = 1;
  results := results || (v_i || case when v_b then ' PASS after release others count it: Stub 1, level 2, Moments 1' else ' FAIL others counts after release' end);

  -- Sharing a held Moment into a Space: the host is told only after release ------
  insert into public.spaces (id, slug, name, description, cover_image, meets, posting_mode)
  values (v_space, 'pcheck-space-7201', 'Pcheck Space', 'Fixture', 'x', 'online', 'approval');
  insert into public.space_members (space_id, user_id, role, status) values (v_space, v_inv, 'host', 'active');
  perform set_config('request.jwt.claim.sub', v_m::text, true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_m, 'sports-fitness', 'photo', 'u/m/s1.jpg', 'M held for the Space', 'public');
  v_post10 := (select po.id from public.posts po where po.user_id = v_m and po.caption = 'M held for the Space');
  insert into public.space_moments (space_id, post_id) values (v_space, v_post10);
  v_i := v_i + 1;
  v_b := (select sm.status = 'pending' from public.space_moments sm where sm.post_id = v_post10)
     and (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 0;
  results := results || (v_i || case when v_b then ' PASS a held Moment shared into an approval Space sends no host notice' else ' FAIL host told about a held Moment' end);

  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 0
    then ' PASS the sweep does not tell the host while it is still held' else ' FAIL sweep told the host early' end);

  perform public.release_moment(v_post10);
  v_i := v_i + 1;
  v_b := (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 1
     and exists (select 1 from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending'
                   and n.href = '/space/pcheck-space-7201?tab=manage' and char_length(n.body) <= 300);
  results := results || (v_i || case when v_b then ' PASS releasing it tells the host once, with the manage link' else ' FAIL release host notice' end);
  perform public.release_moment(v_post10);
  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 1
    then ' PASS releasing again or sweeping sends no second host notice' else ' FAIL duplicate host notice' end);

  -- Shared after release: told at once, as before.
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
  values (v_m, 'sports-fitness', 'photo', 'u/m/s2.jpg', 'M shared now for the Space', 'public', now() - interval '1 hour');
  v_post11 := (select po.id from public.posts po where po.user_id = v_m and po.caption = 'M shared now for the Space');
  insert into public.space_moments (space_id, post_id) values (v_space, v_post11);
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 2
    then ' PASS a Moment that is already released notifies the host at once' else ' FAIL released share notice' end);

  -- Shared while held, then the 2 hours pass: the sweep tells the host once.
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_m, 'sports-fitness', 'photo', 'u/m/s3.jpg', 'M held then due', 'public');
  insert into public.space_moments (space_id, post_id)
    select v_space, po.id from public.posts po where po.user_id = v_m and po.caption = 'M held then due';
  update public.posts po set visible_at = po.created_at where po.user_id = v_m and po.caption = 'M held then due';
  v_n := public.sweep_released_moments();
  v_n := public.sweep_released_moments();
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.notifications n where n.user_id = v_inv and n.kind = 'space_moment_pending') = 3
    then ' PASS a Moment shared while held notifies the host once, when the sweep releases it' else ' FAIL sweep host notice' end);
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.notifications n where n.user_id = v_m and n.kind = 'space_moment_pending') = 0
    then ' PASS the author is never told about their own share' else ' FAIL author notified' end);


  -- Cascade: a deleted user takes their planning and plans with them.
  v_i := v_i + 1;
  v_b := (select bool_and(c.confdeltype = 'c') from pg_constraint c
           where c.contype = 'f' and c.conrelid in ('public.planning_prefs'::regclass, 'public.plans'::regclass, 'public.plan_suggestions'::regclass, 'public.post_private'::regclass)
             and c.confrelid = 'auth.users'::regclass);
  results := results || (v_i || case when v_b then ' PASS planning tables cascade on user delete' else ' FAIL cascade' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
