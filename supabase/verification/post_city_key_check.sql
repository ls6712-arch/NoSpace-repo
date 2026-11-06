-- Soosh: the private city key per Moment (20261118000000_post_city_key.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and everything
-- rolls back. Each expected failure is its own begin...exception...end sub-block with strict
-- sqlstate handling; anything else is recorded as ERROR. No select-into, no returning-into,
-- no delete (CLAUDE.md).
--
-- Fixed ids: U …a001 (profile city ' New   York '), V …a002 (no profile city), C …a003 (a member
-- who tries to read the key). Corner 'sports-fitness/vcheck-citykey'. Every count is scoped to
-- these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_u uuid := '00000000-0000-4000-8000-00000000a001';
  v_v uuid := '00000000-0000-4000-8000-00000000a002';
  v_c uuid := '00000000-0000-4000-8000-00000000a003';
  v_post bigint;
  v_old bigint;
  v_new bigint;
  v_key text;
begin
  v_owner_role := current_user;

  if to_regprocedure('private.city_key_of(uuid, text, boolean, text)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261118000000_post_city_key.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-u@citykey-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-v@citykey-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-c@citykey-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_u, v_v, v_c);
  insert into public.profile_private (user_id, birthdate, city) values
    (v_u, date '1990-01-01', ' New   York '), (v_v, date '1990-01-01', null), (v_c, date '1990-01-01', null)
  on conflict (user_id) do update set birthdate = excluded.birthdate, city = excluded.city;
  insert into public.corners (space_slug, slug, name) values ('sports-fitness', 'vcheck-citykey', 'Vcheck citykey');

  -- 1. city_hidden defaults to false.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience)
  values (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'plain', 'everyone');
  v_post := (select po.id from public.posts po where po.user_id = v_u and po.caption = 'plain');
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts po where po.id = v_post and po.city_hidden is false);
  results := array_append(results, case when v_n = 1 then format('%s PASS (city_hidden defaults to false)', v_i)
                                        else format('%s FAIL', v_i) end);

  -- 2. Public, no city shown, not removed: the key is the profile city, lower-cased, spaces collapsed.
  v_key := (select pp.city_key from public.post_private pp where pp.post_id = v_post);
  v_i := v_i + 1;
  results := array_append(results, case when v_key = 'new york' then format('%s PASS (public Moment gets the profile city as its key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, coalesce(v_key, 'null')) end);

  -- 3. A city the Moment shows wins over the profile city.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'shown', 'everyone', 'Brooklyn');
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_u and po.caption = 'shown');
  v_i := v_i + 1;
  results := array_append(results, case when v_key = 'brooklyn' then format('%s PASS (the city a Moment shows is its key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, coalesce(v_key, 'null')) end);

  -- 4. Not Everyone: no key.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience)
  values (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'friends', 'friends');
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_u and po.caption = 'friends');
  v_i := v_i + 1;
  results := array_append(results, case when v_key is null then format('%s PASS (a friends-only Moment has no key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, v_key) end);

  -- 5. Removed by the person: no key, even though Everyone and the profile has a city.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city_hidden)
  values (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'removed', 'everyone', true);
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_u and po.caption = 'removed');
  v_i := v_i + 1;
  results := array_append(results, case when v_key is null then format('%s PASS (a Moment whose city was removed has no key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, v_key) end);

  -- 6. No profile city and none shown: no key.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience)
  values (v_v, 'sports-fitness', 'vcheck-citykey', 'written', 'nocity', 'everyone');
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_v and po.caption = 'nocity');
  v_i := v_i + 1;
  results := array_append(results, case when v_key is null then format('%s PASS (no profile city and none shown: no key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, v_key) end);

  -- 7. Changing the audience or removing the city later updates the key.
  update public.posts set audience = 'everyone' where public.posts.user_id = v_u and public.posts.caption = 'friends';
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_u and po.caption = 'friends');
  v_i := v_i + 1;
  results := array_append(results, case when v_key = 'new york' then format('%s PASS (friends to Everyone sets the key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, coalesce(v_key, 'null')) end);
  update public.posts set city_hidden = true where public.posts.user_id = v_u and public.posts.caption = 'friends';
  v_key := (select pp.city_key from public.post_private pp join public.posts po on po.id = pp.post_id where po.user_id = v_u and po.caption = 'friends');
  v_i := v_i + 1;
  results := array_append(results, case when v_key is null then format('%s PASS (removing the city clears the key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, v_key) end);

  -- 8. Backfill rule: an old Moment (before 2026-10-30) with no city is filled; a newer one with no
  --    city is left alone, because the person may have removed it; one showing a city is filled.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, created_at)
  values (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'old', 'everyone', timestamptz '2026-09-01 12:00+00'),
         (v_u, 'sports-fitness', 'vcheck-citykey', 'written', 'newer', 'everyone', timestamptz '2026-11-02 12:00+00');
  update public.post_private set city_key = null
   where public.post_private.post_id in (select po.id from public.posts po where po.user_id = v_u);
  -- The backfill statement from the migration, verbatim.
  update public.post_private
     set city_key = private.city_key_of(po.user_id, po.city, po.city_hidden, po.audience)
    from public.posts po
   where po.id = public.post_private.post_id
     and public.post_private.city_key is null
     and po.audience = 'everyone'
     and not po.city_hidden
     and (po.city is not null or po.created_at < timestamptz '2026-10-30 00:00:00+00')
     and po.user_id in (v_u, v_v);
  v_i := v_i + 1;
  v_old := (select po.id from public.posts po where po.user_id = v_u and po.caption = 'old');
  v_new := (select po.id from public.posts po where po.user_id = v_u and po.caption = 'newer');
  v_n := (select count(*) from public.post_private pp where pp.post_id = v_old and pp.city_key = 'new york')
       + (select count(*) from public.post_private pp where pp.post_id = v_new and pp.city_key is not null) * 10
       + (select count(*) from public.post_private pp join public.posts po on po.id = pp.post_id
            where po.user_id = v_u and po.caption = 'shown' and pp.city_key = 'brooklyn') * 100;
  results := array_append(results, case when v_n = 101 then format('%s PASS (backfill fills the old Moment and the one showing a city, not the newer one with none)', v_i)
                                        else format('%s FAIL (score %s)', v_i, v_n) end);

  -- 9. A signed-in member can't read the keys, and can't write one.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.post_private pp where pp.city_key is not null);
    results := array_append(results, format('%s FAIL (a member read post_private: %s rows)', v_i, v_n));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot read post_private, so cannot read a city key)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    update public.post_private set city_key = 'forged' where public.post_private.post_id = v_post;
    results := array_append(results, format('%s FAIL (a member wrote a city key)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot write a city key)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
