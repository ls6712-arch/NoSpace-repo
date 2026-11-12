-- A Moment shared with Followers shows on the Shelf: 20261129000000_shelf_followers_moments.sql.
--
-- Not a migration. Run AFTER 20261129000000_shelf_followers_moments.sql; before it, cases 1 to 3 and 8 fail.
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'.
-- No select-into, no returning-into, no delete (CLAUDE.md). Every lookup is scoped to the fixture's
-- user ids (…9401 to …9405) and captions that start with 'SFM '.
--
-- Fixtures: A owner · F friend of A (they follow each other) · W follows A, accepted, not followed back
--           P a stranger · R asked to follow A, still pending
-- A's Moments: everyone · followers · followers, held for an hour · only you · an older public row for friends
--
-- Cases:
--   1  the owner sees 4: everything but the Only you Moment
--   2  the owner's held Followers Moment carries its visibleAt
--   3  a friend sees 3: everyone, followers, and the older friends row
--   4  a follower sees 2: everyone and followers (not the older friends row, not the held one)
--   5  a stranger sees 1: everyone
--   6  a pending requester sees 1: everyone
--   7  signed out sees 1: everyone
--   8  the list a follower gets holds exactly those 2 Moments, and total matches its length
--   9  nobody but the owner ever gets the Only you Moment

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_j jsonb;
  v_t text;
  results text[] := '{}';
  v_u uuid;
  v_a uuid := '00000000-0000-4000-8000-000000009401';
  v_f uuid := '00000000-0000-4000-8000-000000009402';
  v_w uuid := '00000000-0000-4000-8000-000000009403';
  v_p uuid := '00000000-0000-4000-8000-000000009404';
  v_r uuid := '00000000-0000-4000-8000-000000009405';
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_profile_moments' and p.prosrc like '%''followers''%'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261129000000_shelf_followers_moments.sql first, nothing was created)';
  end if;

  foreach v_u in array array[v_a, v_f, v_w, v_p, v_r] loop
    insert into auth.users
      (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
    values
      (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'sfm.check.' || right(v_u::text, 4) || '@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
    update public.profiles p
       set username = 'sfmcheck' || right(v_u::text, 4), display_name = 'Check ' || right(v_u::text, 4)
     where p.id = v_u;
  end loop;

  insert into public.profile_follows (follower_id, followed_id, status) values
    (v_a, v_f, 'accepted'), (v_f, v_a, 'accepted'),
    (v_w, v_a, 'accepted'),
    (v_r, v_a, 'pending');

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_a), true);
  begin
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience, visible_at) values
      (v_a, 'sports-fitness', 'written', '', 'SFM everyone', 'public', 'everyone', now()),
      (v_a, 'sports-fitness', 'written', '', 'SFM followers', 'followers', 'friends', now()),
      (v_a, 'sports-fitness', 'written', '', 'SFM followers held', 'followers', 'friends', now() + interval '1 hour'),
      (v_a, 'sports-fitness', 'written', '', 'SFM only you', 'just_me', null, now()),
      (v_a, 'sports-fitness', 'written', '', 'SFM older friends row', 'public', 'friends', now());
  exception when others then
    results := results || ('0 ERROR fixture insert ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 1, 2: the owner.
  v_j := public.get_profile_moments(v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 4 and jsonb_array_length(v_j -> 'items') = 4
    then ' PASS the owner sees 4' else ' FAIL owner: ' || v_j::text end);
  v_n := (select count(*) from jsonb_array_elements(v_j -> 'items') e
           where e ->> 'caption' = 'SFM followers held' and e ->> 'visibleAt' is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the held Followers Moment carries visibleAt' else ' FAIL held: ' || v_j::text end);

  -- 3: a friend.
  perform set_config('request.jwt.claim.sub', v_f::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_f), true);
  v_j := public.get_profile_moments(v_a);
  v_t := (select string_agg(e ->> 'caption', '|' order by e ->> 'caption') from jsonb_array_elements(v_j -> 'items') e);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 3 and v_t = 'SFM everyone|SFM followers|SFM older friends row'
    then ' PASS a friend sees 3' else ' FAIL friend: ' || v_j::text end);

  -- 4, 8: a follower.
  perform set_config('request.jwt.claim.sub', v_w::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_w), true);
  v_j := public.get_profile_moments(v_a);
  v_t := (select string_agg(e ->> 'caption', '|' order by e ->> 'caption') from jsonb_array_elements(v_j -> 'items') e);
  v_i := v_i + 1;
  results := results || (v_i || case when (v_j ->> 'total')::int = 2 then ' PASS a follower sees 2' else ' FAIL follower total: ' || v_j::text end);

  -- 5: a stranger.
  perform set_config('request.jwt.claim.sub', v_p::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_p), true);
  v_n := (public.get_profile_moments(v_a) ->> 'total')::int;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a stranger sees 1' else ' FAIL stranger: ' || v_n end);

  -- 6: a pending requester.
  perform set_config('request.jwt.claim.sub', v_r::text, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_r), true);
  v_n := (public.get_profile_moments(v_a) ->> 'total')::int;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a pending requester sees 1' else ' FAIL pending: ' || v_n end);

  -- 7: signed out.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_n := (public.get_profile_moments(v_a) ->> 'total')::int;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS signed out sees 1' else ' FAIL signed out: ' || v_n end);

  -- 8: the follower's list, kept from case 4.
  v_i := v_i + 1;
  results := results || (v_i || case when v_t = 'SFM everyone|SFM followers' and jsonb_array_length(v_j -> 'items') = (v_j ->> 'total')::int
    then ' PASS a follower gets exactly everyone and followers' else ' FAIL follower list: ' || coalesce(v_t, 'none') end);

  -- 9: Only you stays with the owner, for every other viewer.
  v_n := 0;
  foreach v_u in array array[v_f, v_w, v_p, v_r] loop
    perform set_config('request.jwt.claim.sub', v_u::text, true);
    perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_u), true);
    v_n := v_n + (select count(*) from jsonb_array_elements(public.get_profile_moments(v_a) -> 'items') e
                   where e ->> 'caption' = 'SFM only you');
  end loop;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS nobody else gets the Only you Moment' else ' FAIL only you leaked ' || v_n end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
