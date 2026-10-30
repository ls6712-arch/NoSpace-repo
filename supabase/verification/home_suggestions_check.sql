-- Home v2, PR 1: home_suggestions(), suggestion_events and log_suggestion_event().
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261109000000_home_suggestions.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure
-- is its own begin...exception...end sub-block with strict sqlstate handling; anything
-- unexpected is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No
-- select-into, no returning-into, no delete (CLAUDE.md). The script edits one row of
-- app_config (the pass-to-Corner map) inside the transaction; the rollback restores it.
--
-- Fixed ids. Users: A …8101 (the caller), B …8102 (a friend A follows), C …8103 (blocked
-- by A), D …8104 (a test account), E …8105 (runs the events), F …8106 and G …8107 (other
-- callers), H …8108 (no birthdate, so not active). Corners 'hs/hs-c01' to 'hs/hs-c30', one
-- Space and one event each (titles 'HS event NN'), spaces …8201 to …8230. Every lookup is
-- scoped to those ids and titles, never to a whole live table.
--
-- Event map (day+N means N days from today at 19:00 New York time):
--   01 picked, in A's free window (day+4), friend B going; 01b second event, same Corner
--   02 in the window (day+4) / 03 not in it (day+5)         window signal
--   04 picked / 05 not picked                               picked signal
--   06 friend B going, A not a member of the Space / 07 nobody going   friends signal
--   28 friend B going, A is an active member of the Space   friend named only here
--   pursuit hs-pursuit-1 (Corner 19): friend B joined, A not a member   friend counts, not named
--   08 same neighborhood / 09 same city / 10 other city     nearby signal
--   11 priced Free / 12 priced $40                          budget signal (A's budget is 0)
--   13 a Corner A's climbing pass covers / 14 not           pass signal
--   15 two new RSVPs from people A does not follow / 16 none  trending signal
--   17 and 18 cancelled (18 is a picked Corner), 19 beyond 7 days, 20 already started, 21 made by A,
--   22 A already going, 23 full, 24 made by blocked C, 25 made by test account D,
--   26 closed Space, 27 A hosts the Space   (excluded: none may appear for A)
--   29 in 10 hours / 30 in 5 days                           soon signal (for G, who has no answers)

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_refs text[];
  v_keys text[];
  v_cols text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000008101';
  v_b uuid := '00000000-0000-4000-8000-000000008102';
  v_c uuid := '00000000-0000-4000-8000-000000008103';
  v_d uuid := '00000000-0000-4000-8000-000000008104';
  v_e uuid := '00000000-0000-4000-8000-000000008105';
  v_f uuid := '00000000-0000-4000-8000-000000008106';
  v_g uuid := '00000000-0000-4000-8000-000000008107';
  v_h uuid := '00000000-0000-4000-8000-000000008108';
  v_t4 timestamptz := ((((now() at time zone 'America/New_York')::date + 4) + time '19:00') at time zone 'America/New_York');
  v_t5 timestamptz := ((((now() at time zone 'America/New_York')::date + 5) + time '19:00') at time zone 'America/New_York');
  v_t9 timestamptz := ((((now() at time zone 'America/New_York')::date + 9) + time '19:00') at time zone 'America/New_York');
  v_key4 text;
  v_s1 double precision;
  v_s2 double precision;
  v_s3 double precision;
  v_why text[];
  v_name text;
  v_ids bigint[];
begin
  v_owner_role := current_user;

  if to_regprocedure('public.home_suggestions(integer)') is null
     or to_regprocedure('public.log_suggestion_event(text,text,text,integer,double precision,text[],text)') is null
     or to_regclass('public.suggestion_events') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261109000000_home_suggestions.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (owner) role, which bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values
    (v_a, 'hs.a@acct-test.invalid'), (v_b, 'hs.b@acct-test.invalid'), (v_c, 'hs.c@acct-test.invalid'),
    (v_d, 'hs.d@acct-test.invalid'), (v_e, 'hs.e@acct-test.invalid'), (v_f, 'hs.f@acct-test.invalid'),
    (v_g, 'hs.g@acct-test.invalid'), (v_h, 'hs.h@acct-test.invalid')
  ) as u(id, email);

  update public.profiles p set display_name = 'Priya Fixture' where p.id = v_b;
  update public.profiles p set is_test = true where p.id = v_d;

  -- A birthdate on file makes an account active (20261108000000). H gets none.
  insert into public.profile_private (user_id, birthdate) values
    (v_a, (current_date - interval '25 years')::date), (v_b, (current_date - interval '25 years')::date),
    (v_c, (current_date - interval '25 years')::date), (v_d, (current_date - interval '25 years')::date),
    (v_e, (current_date - interval '25 years')::date), (v_f, (current_date - interval '25 years')::date),
    (v_g, (current_date - interval '25 years')::date);

  v_key4 := case extract(isodow from (v_t4 at time zone 'America/New_York'))::integer
              when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu' when 5 then 'fri' when 6 then 'sat' else 'sun' end || '-eve';

  update public.profile_private pp
  set city = 'New York', area = 'Greenpoint', monthly_budget = 0,
      picks = array['hs/hs-c01', 'hs/hs-c04', 'hs/hs-c18']::text[],
      free_windows = array[v_key4]::text[]
  where pp.user_id = v_a;

  insert into public.user_passes (user_id, kind, label) values (v_a, 'climbing', 'Climbing');
  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_c);
  insert into public.profile_follows (follower_id, followed_id, status) values (v_a, v_b, 'accepted');

  -- The pass-to-Corner map: this transaction only; the rollback restores it.
  update public.app_config c
  set value = jsonb_set(c.value, '{pass_corners}', '{"climbing": ["hs/hs-c13"]}'::jsonb)
  where c.key = 'home_ranking_v1';

  insert into public.corners (space_slug, slug, name)
  select 'hs', 'hs-c' || lpad(g::text, 2, '0'), 'HS corner ' || g from generate_series(1, 30) g;

  insert into public.spaces (id, slug, name, description, cover_image, meets, neighborhood, city, access)
  select ('00000000-0000-4000-8000-00000000' || lpad((8200 + g)::text, 4, '0'))::uuid,
         'hs-space-' || lpad(g::text, 2, '0'), 'HS space ' || g, 'fixture', 'fixture', 'in_person', 'Greenpoint', 'New York',
         case when g = 26 then 'closed' else 'open' end
  from generate_series(1, 30) g;

  insert into public.space_corners (space_id, corner_id, is_primary)
  select sp.id, co.id, true
  from public.spaces sp
  join public.corners co on co.slug = 'hs-c' || right(sp.slug, 2)
  where sp.slug like 'hs-space-%';

  insert into public.space_members (space_id, user_id, role, status)
  values ('00000000-0000-4000-8000-000000008227', v_a, 'host', 'active'),
         ('00000000-0000-4000-8000-000000008228', v_a, 'member', 'active');

  -- An open Pursuit in Corner 19 that friend B has joined; A is not a member of it. Live requires an
  -- open Pursuit to be shared and to have a capacity (pursuits_open_is_shared_with_capacity).
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, visibility, shared, space_id, capacity)
  values ('hs-pursuit-1', v_e, 'HS pursuit 1', 'hs', 'hs-c19', 'open', true, '00000000-0000-4000-8000-000000008219', 5);
  insert into public.pursuit_members (pursuit_id, user_id, role, status) values ('hs-pursuit-1', v_b, 'member', 'joined');
  insert into public.pursuit_sessions (pursuit_id, starts_at, place, created_by) values ('hs-pursuit-1', v_t5, 'HS studio', v_e);

  -- One event per Space at day+5, 19:00, made by E; then the differences.
  insert into public.space_events (space_id, title, starts_at, timezone, meets, neighborhood, city, created_by)
  select ('00000000-0000-4000-8000-00000000' || lpad((8200 + g)::text, 4, '0'))::uuid,
         'HS event ' || lpad(g::text, 2, '0'), v_t5, 'America/New_York', 'in_person', 'Greenpoint', 'New York', v_e
  from generate_series(1, 30) g;
  insert into public.space_events (space_id, title, starts_at, timezone, meets, neighborhood, city, created_by)
  values ('00000000-0000-4000-8000-000000008201', 'HS event 01b', v_t5, 'America/New_York', 'in_person', 'Greenpoint', 'New York', v_e);

  update public.space_events e set starts_at = v_t4 where e.title in ('HS event 01', 'HS event 02');
  update public.space_events e set neighborhood = 'Astoria' where e.title = 'HS event 09';
  update public.space_events e set neighborhood = null, city = 'Austin' where e.title = 'HS event 10';
  update public.space_events e set price = 'Free' where e.title = 'HS event 11';
  update public.space_events e set price = '$40' where e.title = 'HS event 12';
  update public.space_events e set status = 'cancelled' where e.title in ('HS event 17', 'HS event 18');
  update public.space_events e set starts_at = v_t9 where e.title = 'HS event 19';
  update public.space_events e set starts_at = now() - interval '1 day' where e.title = 'HS event 20';
  update public.space_events e set created_by = v_a where e.title = 'HS event 21';
  update public.space_events e set capacity = 1 where e.title = 'HS event 23';
  update public.space_events e set created_by = v_c where e.title = 'HS event 24';
  update public.space_events e set created_by = v_d where e.title = 'HS event 25';
  update public.space_events e set starts_at = now() + interval '10 hours' where e.title = 'HS event 29';
  -- 29 and 30 are for G; they are A's own events so A's list of 20 keeps room for the rest.
  update public.space_events e set created_by = v_a where e.title in ('HS event 29', 'HS event 30');

  insert into public.event_rsvps (event_id, user_id)
  select e.id, x.uid
  from public.space_events e
  join (values
    ('HS event 01', v_b), ('HS event 06', v_b), ('HS event 22', v_a), ('HS event 23', v_f),
    ('HS event 15', v_f), ('HS event 15', v_g), ('HS event 28', v_b)
  ) as x(title, uid) on x.title = e.title;

  -- ───────────────────────────────────────────────────────────────────────
  -- As A: what comes back, and what must not.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_refs := (select array_agg(h.ref_id order by h.ord)
             from public.home_suggestions(20) with ordinality as h(kind, ref_id, corner_key, starts_at, place_label, score, reasons, title, space_slug, friend_name, pass_kind, ord));

  v_i := v_i + 1;
  results := results || (v_i || case when coalesce(cardinality(v_refs), 0) between 5 and 20 then ' PASS A gets ' || cardinality(v_refs) || ' suggestions' else ' FAIL A got ' || coalesce(cardinality(v_refs), 0) end);

  perform set_config('role', v_owner_role, true);
  v_ids := (select array_agg(e.id) from public.space_events e where e.title in ('HS event 17','HS event 18','HS event 19','HS event 20','HS event 21','HS event 22','HS event 23','HS event 24','HS event 25','HS event 26','HS event 27'));
  v_i := v_i + 1;
  v_n := (select count(*) from unnest(v_refs) r(id) where r.id = any (select x::text from unnest(v_ids) x));
  results := results || (v_i || case when v_n = 0 then ' PASS none of the 11 excluded events appears (cancelled, too late, already started, own, already going, full, blocked, test account, closed Space, hosted)' else ' FAIL ' || v_n || ' excluded events appeared' end);
  perform set_config('role', 'authenticated', true);

  -- Reading the first row.
  v_text := (select h.title from public.home_suggestions(20) h order by h.score desc, h.ref_id limit 1);
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = 'HS event 01' then ' PASS the picked event in A''s free window with a friend going ranks first' else ' FAIL first was ' || coalesce(v_text, 'nothing') end);

  v_why := (select h.reasons from public.home_suggestions(20) h where h.title = 'HS event 01');
  v_i := v_i + 1;
  results := results || (v_i || case when v_why @> array['fits_window']::text[] and cardinality(v_why) <= 2 then ' PASS its reasons name the window (' || array_to_string(v_why, '+') || ')' else ' FAIL reasons ' || coalesce(array_to_string(v_why, '+'), 'none') end);

  -- Signals: each pair differs in one thing only.
  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 02');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 03');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS fits a free window: higher' else ' FAIL window ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 04');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 05');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS a picked Corner: higher' else ' FAIL picked ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 06');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 07');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS a followed friend going: higher' else ' FAIL friends ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  -- Naming: only where A could already see who is going.
  v_name := (select h.friend_name from public.home_suggestions(20) h where h.title = 'HS event 06');
  v_why := (select h.reasons from public.home_suggestions(20) h where h.title = 'HS event 06');
  v_i := v_i + 1;
  results := results || (v_i || case when v_name is null and not (v_why @> array['friend_going']::text[]) and cardinality(v_why) >= 1 then ' PASS a non-member following someone who is going: boosted score (previous check), but no name and no friend_going; the next reason is used (' || array_to_string(v_why, '+') || ')' else ' FAIL non-member saw name ' || coalesce(v_name, 'null') || ' reasons ' || coalesce(array_to_string(v_why, '+'), 'none') end);

  v_name := (select h.friend_name from public.home_suggestions(20) h where h.title = 'HS event 28');
  v_why := (select h.reasons from public.home_suggestions(20) h where h.title = 'HS event 28');
  v_i := v_i + 1;
  results := results || (v_i || case when v_why @> array['friend_going']::text[] and v_name = 'Priya' then ' PASS an active member of the Space gets friend_going and the first name' else ' FAIL member saw name ' || coalesce(v_name, 'null') || ' reasons ' || coalesce(array_to_string(v_why, '+'), 'none') end);

  v_name := (select h.friend_name from public.home_suggestions(20) h where h.ref_id = 'hs-pursuit-1');
  v_why := (select h.reasons from public.home_suggestions(20) h where h.ref_id = 'hs-pursuit-1');
  v_i := v_i + 1;
  results := results || (v_i || case when v_name is null and not (coalesce(v_why, '{}') @> array['friend_going']::text[]) and (select count(*) from public.home_suggestions(20) h where h.ref_id = 'hs-pursuit-1') = 1 then ' PASS an open Pursuit a friend joined: offered, friend not named for a person who has not joined' else ' FAIL pursuit name ' || coalesce(v_name, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 08');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 09');
  v_s3 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 10');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 and v_s2 > v_s3 then ' PASS same neighborhood beats same city beats elsewhere' else ' FAIL nearby ' || coalesce(v_s1::text, 'null') || ' / ' || coalesce(v_s2::text, 'null') || ' / ' || coalesce(v_s3::text, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 11');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 12');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS with a budget of 0, a free listing: higher' else ' FAIL budget ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 13');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 14');
  v_text := (select h.pass_kind from public.home_suggestions(20) h where h.title = 'HS event 13');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 and v_text = 'climbing' then ' PASS a Corner a pass covers: higher, and the pass kind is returned' else ' FAIL pass ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') || ' kind ' || coalesce(v_text, 'null') end);

  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 15');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 16');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS new people joining a Corner: higher' else ' FAIL trending ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  -- Diversity: one item per Corner in the top 4, and a steady order within a day.
  v_keys := (select array_agg(t.corner_key order by t.ord)
             from (select h.corner_key, h.ord
                   from public.home_suggestions(20) with ordinality as h(kind, ref_id, corner_key, starts_at, place_label, score, reasons, title, space_slug, friend_name, pass_kind, ord)
                   order by h.ord limit 4) t);
  v_i := v_i + 1;
  results := results || (v_i || case when cardinality(v_keys) = 4 and (select count(distinct k) from unnest(v_keys) k) = 4 then ' PASS the top 4 are 4 different Corners' else ' FAIL top 4 Corners: ' || coalesce(array_to_string(v_keys, ','), 'none') end);

  v_n := (select h.ord from public.home_suggestions(20) with ordinality as h(kind, ref_id, corner_key, starts_at, place_label, score, reasons, title, space_slug, friend_name, pass_kind, ord) where h.title = 'HS event 01b');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n is null or v_n > 4 then ' PASS the second event in the same Corner is not in the top 4' else ' FAIL second event of a Corner at position ' || v_n end);

  v_text := (select string_agg(h.ref_id, ',' order by h.ord) from public.home_suggestions(20) with ordinality as h(kind, ref_id, corner_key, starts_at, place_label, score, reasons, title, space_slug, friend_name, pass_kind, ord));
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = array_to_string(v_refs, ',') then ' PASS the same order on a second call' else ' FAIL the order changed between two calls' end);

  v_i := v_i + 1;
  results := results || (v_i || case when (select max(h.score) from public.home_suggestions(20) h) <= 1.05 and (select min(h.score) from public.home_suggestions(20) h) >= 0 then ' PASS scores stay between 0 and about 1' else ' FAIL scores out of range' end);

  perform set_config('role', v_owner_role, true);
  v_cols := pg_get_function_result('public.home_suggestions(integer)'::regprocedure);
  v_i := v_i + 1;
  results := results || (v_i || case when v_cols !~* '(price|count|follower|member)' then ' PASS the result has no price, count or follower column' else ' FAIL result columns: ' || v_cols end);
  perform set_config('role', 'authenticated', true);

  -- ───────────────────────────────────────────────────────────────────────
  -- As G, who has answered nothing: sooner is higher; nothing is claimed that is not known.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_g), true);
  v_s1 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 29');
  v_s2 := (select h.score from public.home_suggestions(20) h where h.title = 'HS event 30');
  v_i := v_i + 1;
  results := results || (v_i || case when v_s1 > v_s2 then ' PASS an event in the next 48 hours: higher' else ' FAIL soon ' || coalesce(v_s1::text, 'null') || ' vs ' || coalesce(v_s2::text, 'null') end);

  v_why := (select h.reasons from public.home_suggestions(20) h where h.title = 'HS event 01');
  v_i := v_i + 1;
  results := results || (v_i || case when not (coalesce(v_why, '{}') && array['picked','fits_window','friend_going','pass']::text[]) then ' PASS with no answers saved, no reason claims a pick, a window, a friend or a pass' else ' FAIL reasons for a blank profile: ' || array_to_string(v_why, '+') end);

  -- F: another person gets no sign of A's answers (A picked this Corner; F did not).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_why := (select h.reasons from public.home_suggestions(20) h where h.title = 'HS event 04');
  v_i := v_i + 1;
  results := results || (v_i || case when not (coalesce(v_why, '{}') @> array['picked']::text[]) then ' PASS F is not told "picked" for A''s pick' else ' FAIL F saw A''s pick' end);

  -- H has no birthdate, so is not active and gets nothing.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_h), true);
  v_n := (select count(*) from public.home_suggestions(20));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS an account with no birthdate gets no suggestions' else ' FAIL H got ' || v_n end);

  -- ───────────────────────────────────────────────────────────────────────
  -- The log.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  perform public.log_suggestion_event('event', '1', 'hs/hs-c01', 0, 0.5, array['picked','soon']::text[], 'shown');
  v_n := (select count(*) from public.suggestion_events se where se.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS A logs an event and reads it back' else ' FAIL A has ' || v_n || ' log rows' end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  perform public.log_suggestion_event('at_home', 'hs/hs-c02', 'hs/hs-c02', 1, null, array['affinity']::text[], 'opened');
  v_n := (select count(*) from public.suggestion_events se where se.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS F cannot read A''s log' else ' FAIL F read ' || v_n || ' of A''s rows' end);
  v_n := (select count(*) from public.suggestion_events se where se.user_id = v_f);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS what F logs is F''s (user_id comes from the session)' else ' FAIL F has ' || v_n || ' rows' end);

  v_i := v_i + 1;
  begin
    insert into public.suggestion_events (user_id, surface, kind, ref_id, position, action) values (v_a, 'home', 'event', '1', 0, 'shown');
    results := results || (v_i || ' FAIL a signed-in person inserted a row directly');
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS no direct insert');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.log_suggestion_event('event', '1', null, 0, null, '{}'::text[], 'liked');
    results := results || (v_i || ' FAIL an unknown action was logged');
  exception
    when check_violation then
      results := results || (v_i || ' PASS an unknown action is refused');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.log_suggestion_event('pizza', '1', null, 0, null, '{}'::text[], 'shown');
    results := results || (v_i || ' FAIL an unknown kind was logged');
  exception
    when check_violation then
      results := results || (v_i || ' PASS an unknown kind is refused');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.log_suggestion_event('event', '1', null, 0, null, array['price']::text[], 'shown');
    results := results || (v_i || ' FAIL an unknown reason code was logged');
  exception
    when check_violation then
      results := results || (v_i || ' PASS an unknown reason code is refused');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Signed out cannot run either function.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.home_suggestions(5));
    results := results || (v_i || ' FAIL anon ran home_suggestions');
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS anon cannot run home_suggestions');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    perform public.log_suggestion_event('event', '1', null, 0, null, '{}'::text[], 'shown');
    results := results || (v_i || ' FAIL anon logged an event');
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS anon cannot log');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Keeping the log 90 days.
  perform set_config('role', v_owner_role, true);
  insert into public.suggestion_events (user_id, surface, kind, ref_id, position, action, created_at)
  values (v_a, 'home', 'event', 'old', 0, 'shown', now() - interval '91 days'),
         (v_a, 'home', 'event', 'recent', 0, 'shown', now() - interval '89 days');
  perform public.purge_suggestion_events();
  v_i := v_i + 1;
  results := results || (v_i || case
    when (select count(*) from public.suggestion_events se where se.user_id = v_a and se.ref_id = 'old') = 0
     and (select count(*) from public.suggestion_events se where se.user_id = v_a and se.ref_id = 'recent') = 1
    then ' PASS the purge removes a 91 day old row and keeps an 89 day old one' else ' FAIL purge' end);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    perform public.purge_suggestion_events();
    results := results || (v_i || ' FAIL a signed-in person ran the purge');
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS only the schedule can run the purge');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  results := results || (v_i || case
    when exists (select 1 from cron.job j where j.jobname = 'purge-suggestion-events' and j.schedule = '45 3 * * *' and j.active)
    then ' PASS the nightly purge is scheduled at 03:45 UTC' else ' FAIL no active purge-suggestion-events job' end);

  -- Catalog facts: security definer with a pinned search_path, and the cascade.
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from pg_proc p
          where p.oid in ('public.home_suggestions(integer)'::regprocedure, 'public.log_suggestion_event(text,text,text,integer,double precision,text[],text)'::regprocedure)
            and p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS both functions are security definer with a pinned search_path' else ' FAIL ' || v_n || ' of 2' end);
  v_n := (select count(*) from pg_constraint c where c.conrelid = 'public.suggestion_events'::regclass and c.contype = 'f' and c.confdeltype = 'c');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n >= 1 then ' PASS log rows go with the account' else ' FAIL no cascade on suggestion_events' end);

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
