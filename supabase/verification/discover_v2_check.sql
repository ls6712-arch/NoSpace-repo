-- Discover v2, PR 1: discover_moments(), discover_corners(), discover_spaces() and
-- log_discover_event().
--
-- Not a migration; nothing here changes the schema or the data for good. Run this AFTER
-- 20261111000000_discover_v2.sql. Run before it, the script stops and says "NOT APPLIED"
-- and creates nothing.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is
-- its own begin...exception...end sub-block with strict sqlstate handling; anything
-- unexpected is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No
-- select-into, no returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A …9101 (the viewer), B …9102 (A follows B), C …9103 (blocked by A),
-- D …9104 (a test account), E …9105 (a stranger, New York), F …9106 (a stranger who
-- posted into a Space A joined), G …9107 (a stranger in Austin), H …9108 (a stranger,
-- posts only to followers), I …9109 (another viewer). Corners 'dv/dv-c01' to 'dv/dv-c05'.
-- Spaces …9201 (A joined), …9202 (open, A has not joined), …9203 (closed), …9204 (A asked
-- to join), …9205 (open, A's neighborhood), …9206 (open, Austin). Moments carry the
-- caption 'DV moment NN'. Every lookup is scoped to these ids and captions.
--
-- Moments: 01 from E (must appear) / 02 from B, followed / 03 from F, shared to Space 9201
-- / 04 from A / 05 from C, blocked / 06 from D, test account / 07 from H, followers only /
-- 08 from G, Austin / 09 from E, 'friends' audience / 10 from E, corner dv-c02.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_keys text[];
  v_caps text[];
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009101';
  v_b uuid := '00000000-0000-4000-8000-000000009102';
  v_c uuid := '00000000-0000-4000-8000-000000009103';
  v_d uuid := '00000000-0000-4000-8000-000000009104';
  v_e uuid := '00000000-0000-4000-8000-000000009105';
  v_f uuid := '00000000-0000-4000-8000-000000009106';
  v_g uuid := '00000000-0000-4000-8000-000000009107';
  v_h uuid := '00000000-0000-4000-8000-000000009108';
  v_x uuid := '00000000-0000-4000-8000-000000009109';
  v_ids bigint[];
begin
  v_owner_role := current_user;

  if to_regprocedure('public.discover_moments(text,timestamptz,integer)') is null
     or to_regprocedure('public.discover_corners(integer,text[])') is null
     or to_regprocedure('public.discover_spaces(integer)') is null
     or to_regprocedure('public.log_discover_event(text,text,text,integer,text)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000000_discover_v2.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (owner) role, which bypasses RLS. ----------------------
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values
    (v_a, 'dv.a@acct-test.invalid'), (v_b, 'dv.b@acct-test.invalid'), (v_c, 'dv.c@acct-test.invalid'),
    (v_d, 'dv.d@acct-test.invalid'), (v_e, 'dv.e@acct-test.invalid'), (v_f, 'dv.f@acct-test.invalid'),
    (v_g, 'dv.g@acct-test.invalid'), (v_h, 'dv.h@acct-test.invalid'), (v_x, 'dv.i@acct-test.invalid')
  ) as u(id, email);

  update public.profiles p set is_test = true where p.id = v_d;

  insert into public.profile_private (user_id, birthdate, city, area)
  select u.id, (current_date - interval '25 years')::date, u.city, u.area
  from (values
    (v_a, 'New York', 'Greenpoint'), (v_b, 'New York', null), (v_c, 'New York', null), (v_d, 'New York', null),
    (v_e, 'New York', null), (v_f, 'New York', null), (v_g, 'Austin', null), (v_h, 'New York', null),
    (v_x, 'New York', null)
  ) as u(id, city, area);

  insert into public.profile_follows (follower_id, followed_id, status) values (v_a, v_b, 'accepted');
  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_c);

  insert into public.corners (space_slug, slug, name)
  select 'dv', 'dv-c' || lpad(g::text, 2, '0'), 'DV corner ' || g from generate_series(1, 5) g;

  insert into public.spaces (id, slug, name, description, cover_image, meets, neighborhood, city, access)
  values
    ('00000000-0000-4000-8000-000000009201', 'dv-space-1', 'DV joined', 'fixture', 'fixture', 'in_person', 'Greenpoint', 'New York', 'open'),
    ('00000000-0000-4000-8000-000000009202', 'dv-space-2', 'DV open', 'fixture', 'fixture', 'in_person', 'Astoria', 'New York', 'open'),
    ('00000000-0000-4000-8000-000000009203', 'dv-space-3', 'DV closed', 'fixture', 'fixture', 'in_person', 'Astoria', 'New York', 'closed'),
    ('00000000-0000-4000-8000-000000009204', 'dv-space-4', 'DV asked', 'fixture', 'fixture', 'in_person', 'Astoria', 'New York', 'closed'),
    ('00000000-0000-4000-8000-000000009205', 'dv-space-5', 'DV near', 'fixture', 'fixture', 'in_person', 'Greenpoint', 'New York', 'open'),
    ('00000000-0000-4000-8000-000000009206', 'dv-space-6', 'DV Austin', 'fixture', 'fixture', 'in_person', 'Downtown', 'Austin', 'open');

  insert into public.space_corners (space_id, corner_id, is_primary)
  select sp.id, co.id, true
  from public.spaces sp
  join public.corners co on co.slug = 'dv-c0' || right(sp.slug, 1)
  where sp.slug like 'dv-space-%' and right(sp.slug, 1) between '1' and '5';

  insert into public.space_members (space_id, user_id, role, status)
  values ('00000000-0000-4000-8000-000000009201', v_a, 'member', 'active'),
         ('00000000-0000-4000-8000-000000009201', v_f, 'member', 'active');
  insert into public.space_join_requests (space_id, user_id) values ('00000000-0000-4000-8000-000000009204', v_a);

  insert into public.posts (user_id, hobby_slug, sub_hobby, type, media_url, caption, visibility, audience)
  select m.uid, 'dv', m.corner, 'text', 'fixture', m.cap, m.vis, m.aud
  from (values
    (v_e, 'dv-c01', 'DV moment 01', 'public', null::text),
    (v_b, 'dv-c01', 'DV moment 02', 'public', null),
    (v_f, 'dv-c01', 'DV moment 03', 'public', null),
    (v_a, 'dv-c01', 'DV moment 04', 'public', null),
    (v_c, 'dv-c01', 'DV moment 05', 'public', null),
    (v_d, 'dv-c01', 'DV moment 06', 'public', null),
    (v_h, 'dv-c01', 'DV moment 07', 'followers', 'friends'),
    (v_g, 'dv-c01', 'DV moment 08', 'public', null),
    (v_e, 'dv-c01', 'DV moment 09', 'followers', 'friends'),
    (v_e, 'dv-c02', 'DV moment 10', 'public', 'everyone')
  ) as m(uid, corner, cap, vis, aud);

  insert into public.space_moments (space_id, post_id, status)
  select '00000000-0000-4000-8000-000000009201', po.id, 'approved'
  from public.posts po where po.caption = 'DV moment 03';

  -- As A: discover_moments ------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_caps := (select array_agg(po.caption order by po.caption)
             from public.discover_moments(null, null, 50) dm
             join public.posts po on po.id = dm.post_id
             where po.caption like 'DV moment %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_caps = array['DV moment 01', 'DV moment 10'] then ' PASS A sees exactly the stranger Everyone Moments (01, 10)' else ' FAIL A saw ' || coalesce(array_to_string(v_caps, '+'), 'nothing') end);

  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 02' <> all (coalesce(v_caps, '{}')) then ' PASS a followed author never appears' else ' FAIL followed author appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 03' <> all (coalesce(v_caps, '{}')) then ' PASS a Moment shared to a joined Space never appears' else ' FAIL joined Space Moment appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 04' <> all (coalesce(v_caps, '{}')) then ' PASS the viewer''s own Moment never appears' else ' FAIL own Moment appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 05' <> all (coalesce(v_caps, '{}')) then ' PASS a blocked person''s Moment never appears' else ' FAIL blocked Moment appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 06' <> all (coalesce(v_caps, '{}')) then ' PASS a test account''s Moment never appears' else ' FAIL test account Moment appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 07' <> all (coalesce(v_caps, '{}')) and 'DV moment 09' <> all (coalesce(v_caps, '{}')) then ' PASS a followers-only Moment (visibility and audience) never appears' else ' FAIL non-Everyone Moment appeared' end);
  v_i := v_i + 1;
  results := results || (v_i || case when 'DV moment 08' <> all (coalesce(v_caps, '{}')) then ' PASS an author in another city never appears' else ' FAIL other city appeared' end);

  v_caps := (select array_agg(po.caption order by po.caption)
             from public.discover_moments('dv/dv-c02', null, 50) dm
             join public.posts po on po.id = dm.post_id
             where po.caption like 'DV moment %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_caps = array['DV moment 10'] then ' PASS the Corner filter keeps only that Corner' else ' FAIL filter gave ' || coalesce(array_to_string(v_caps, '+'), 'nothing') end);

  v_n := (select count(*) from public.discover_moments(null, now() - interval '100 years', 50));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a cursor older than every Moment returns nothing' else ' FAIL cursor returned ' || v_n end);

  -- Following E removes E's Moments from Discover (the loop).
  perform set_config('role', v_owner_role, true);
  insert into public.profile_follows (follower_id, followed_id, status) values (v_a, v_e, 'accepted');
  perform set_config('role', 'authenticated', true);
  v_n := (select count(*) from public.discover_moments(null, null, 50) dm join public.posts po on po.id = dm.post_id where po.caption like 'DV moment %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS after A follows E, E''s Moments leave Discover' else ' FAIL ' || v_n || ' left after following' end);

  -- discover_corners ----------------------------------------------------------------
  perform set_config('role', v_owner_role, true);
  update public.profile_private pp set picks = array['dv/dv-c01']::text[] where pp.user_id = v_a;
  insert into public.hobby_follows (user_id, hobby_key) values (v_a, 'dv:dv-c02');
  insert into public.posts (user_id, hobby_slug, sub_hobby, type, media_url, caption, visibility)
  values (v_a, 'dv', 'dv-c03', 'text', 'fixture', 'DV own moment', 'public');
  perform set_config('role', 'authenticated', true);

  v_keys := (select array_agg(dc.corner_key order by dc.corner_key)
             from public.discover_corners(10, array['dv/dv-c01','dv/dv-c02','dv/dv-c03','dv/dv-c04','dv/dv-c05']) dc);
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = array['dv/dv-c04', 'dv/dv-c05'] then ' PASS picked (c01), followed (c02) and already-logged (c03) Corners are never offered' else ' FAIL offered ' || coalesce(array_to_string(v_keys, '+'), 'nothing') end);

  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.discover_corners(1, array['dv/dv-c04','dv/dv-c05'])) = 1 then ' PASS the limit is honoured' else ' FAIL limit ignored' end);

  v_i := v_i + 1;
  results := results || (v_i || case when (select dc.has_place from public.discover_corners(10, array['dv/dv-c04']) dc) is false
                                      and (select dc.has_place from public.discover_corners(10, array['dv/dv-c05']) dc) is true
    then ' PASS has_place is true only where an open Space is in the city' else ' FAIL has_place' end);

  -- discover_spaces -----------------------------------------------------------------
  v_keys := (select array_agg(ds.slug order by ds.slug) from public.discover_spaces(30) ds where ds.slug like 'dv-space-%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_keys = array['dv-space-2', 'dv-space-3', 'dv-space-5'] then ' PASS only Spaces in the city A has not joined or asked about (open and closed)' else ' FAIL spaces ' || coalesce(array_to_string(v_keys, '+'), 'nothing') end);

  v_i := v_i + 1;
  results := results || (v_i || case when (select ds.slug from public.discover_spaces(30) ds where ds.slug like 'dv-space-%' limit 1) = 'dv-space-5' then ' PASS the Space in A''s own neighborhood comes first' else ' FAIL area did not rank first' end);

  v_i := v_i + 1;
  results := results || (v_i || case when (select ds.access from public.discover_spaces(30) ds where ds.slug = 'dv-space-3') = 'closed' then ' PASS a Closed Space is returned as closed' else ' FAIL access' end);

  -- Nothing about people, only counts of Moments --------------------------------------
  perform set_config('role', v_owner_role, true);
  v_text := (select string_agg(a.attname, ',') from pg_proc p
             join lateral unnest(p.proargnames) with ordinality as a(attname, ord) on true
             where p.proname in ('discover_moments', 'discover_corners', 'discover_spaces')
               and p.pronamespace = 'public'::regnamespace
               and (a.attname ilike '%follower%' or a.attname ilike '%member%count%' or a.attname ilike '%members%'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_text is null then ' PASS no function returns a follower or member count column' else ' FAIL columns ' || v_text end);

  -- Logging --------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  perform public.log_discover_event('idea', 'dv/dv-c04', 'dv/dv-c04', 0, 'shown');
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.suggestion_events se where se.user_id = v_a and se.surface = 'discover' and se.ref_id = 'dv/dv-c04' and se.kind = 'idea') = 1
    then ' PASS a Discover row is written for the caller' else ' FAIL no row' end);
  v_i := v_i + 1;
  results := results || (v_i || case when (select count(*) from public.suggestion_events se where se.user_id = v_x and se.ref_id = 'dv/dv-c04') = 0
    then ' PASS and for nobody else' else ' FAIL another user got a row' end);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_x), true);
  begin
    perform public.log_discover_event('idea', 'dv/dv-c04', null, 0, 'going');
    results := results || ((v_i + 1) || ' FAIL a Home action was accepted');
  exception
    when invalid_parameter_value then results := results || ((v_i + 1) || ' PASS an action Discover does not have is refused');
    when others then results := results || ((v_i + 1) || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.log_discover_event('idea', 'x', null, 0, 'shown');
    results := results || ((v_i + 1) || ' FAIL anon logged');
  exception
    when insufficient_privilege then results := results || ((v_i + 1) || ' PASS anon cannot log');
    when others then results := results || ((v_i + 1) || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    perform public.discover_moments();
    results := results || ((v_i + 1) || ' FAIL anon read Discover Moments');
  exception
    when insufficient_privilege then results := results || ((v_i + 1) || ' PASS anon cannot read Discover Moments');
    when others then results := results || ((v_i + 1) || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;

  -- Catalog facts ----------------------------------------------------------------------
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from pg_proc p
          where p.oid in ('public.discover_moments(text,timestamptz,integer)'::regprocedure,
                          'public.discover_corners(integer,text[])'::regprocedure,
                          'public.discover_spaces(integer)'::regprocedure,
                          'public.log_discover_event(text,text,text,integer,text)'::regprocedure)
            and p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 4 then ' PASS all four functions are security definer with a pinned search_path' else ' FAIL ' || v_n || ' of 4' end);

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
