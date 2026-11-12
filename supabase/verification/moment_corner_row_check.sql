-- A Moment can be saved into a Corner that has no row yet: 20261126000000_moment_corner_row.sql.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261126000000_moment_corner_row.sql. Run before it, the script stops and says "NOT APPLIED".
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'
-- so a rollback is guaranteed. Each expected failure is its own begin...exception...end sub-block
-- with strict sqlstate handling. No select-into, no returning-into, no delete (CLAUDE.md). Every
-- lookup is scoped to the fixture's own user id and the Corner slugs that start with 'vcr-'.
--
-- Fixed id: user …9201. Space home-garden (exists in public.categories).
--
-- Cases:
--   1  a Moment into a Corner with no row saves, as a signed-in member
--   2  the Corner row is made with moment_count 0 and a sentence-case name
--   3  a second Moment into the same Corner saves and makes no second row
--   4  moving a saved Moment into a Corner with no row (the Posted screen) saves and makes the row
--   5  a malformed Corner slug is still rejected by the foreign key (23503) and makes no row
--   6  a Corner in a Space that does not exist is still rejected (23503) and makes no row
--   7  a Moment with no Corner makes no row
--   8  the trigger function is security definer, has a pinned search_path, and clients cannot execute it

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_post bigint;
  v_owner_role text;
  results text[] := '{}';
  v_u uuid := '00000000-0000-4000-8000-000000009201';
begin
  v_owner_role := current_user;

  if to_regprocedure('private.posts_ensure_corner()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261126000000_moment_corner_row.sql first, nothing was created)';
  end if;
  if exists (select 1 from public.corners c where c.slug like 'vcr-%') then
    raise exception 'RESULTS: STOPPED (Corner rows starting with vcr- already exist; the fixture needs them absent)';
  end if;

  -- Fixture, as the connecting (owner) role.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcr.u@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  -- A birthdate on file makes an account active, which is what the member gate checks.
  insert into public.profile_private (user_id, birthdate) values (v_u, (current_date - interval '25 years')::date);

  -- As the member.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_u), true);

  -- 1. Moment into a Corner with no row.
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, audience)
    values (v_u, 'home-garden', 'vcr-veg-patch', 'written', '', 'VCR one', 'public', 'everyone');
    results := results || (v_i || ' PASS a Moment into a Corner with no row saves');
  exception when others then
    results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;

  perform set_config('role', v_owner_role, true);

  -- 2. The row, its count and its name.
  v_n := (select count(*) from public.corners c where c.space_slug = 'home-garden' and c.slug = 'vcr-veg-patch' and c.moment_count = 0);
  v_text := (select c.name from public.corners c where c.space_slug = 'home-garden' and c.slug = 'vcr-veg-patch');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 and v_text = 'Vcr veg patch' then ' PASS the Corner row is made with count 0 and a sentence-case name' else ' FAIL rows ' || v_n || ', name ' || coalesce(v_text, 'none') end);

  -- 3. A second Moment, same Corner.
  perform set_config('role', 'authenticated', true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, audience)
    values (v_u, 'home-garden', 'vcr-veg-patch', 'written', '', 'VCR two', 'followers', 'friends');
    perform set_config('role', v_owner_role, true);
    v_n := (select count(*) from public.corners c where c.space_slug = 'home-garden' and c.slug = 'vcr-veg-patch');
    results := results || (v_i || case when v_n = 1 then ' PASS a second Moment saves and makes no second row' else ' FAIL ' || v_n || ' rows' end);
  exception when others then
    results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);

  -- 4. Moving a saved Moment with no Corner into a Corner with no row.
  perform set_config('role', 'authenticated', true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, audience)
    values (v_u, null, null, 'written', '', 'VCR move', 'public', 'everyone');
    v_post := (select max(p.id) from public.posts p where p.user_id = v_u and p.caption = 'VCR move');
    update public.posts p set hobby_slug = 'home-garden', corner = 'vcr-herbs', sub_hobby = 'vcr-herbs' where p.id = v_post;
    perform set_config('role', v_owner_role, true);
    v_n := (select count(*) from public.posts p where p.id = v_post and p.corner = 'vcr-herbs')
         + (select count(*) from public.corners c where c.space_slug = 'home-garden' and c.slug = 'vcr-herbs');
    results := results || (v_i || case when v_n = 2 then ' PASS moving a Moment into a Corner with no row saves and makes the row' else ' FAIL ' || v_n || ' of 2' end);
  exception when others then
    results := results || (v_i || ' FAIL ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);

  -- 5. Malformed slug: still rejected.
  perform set_config('role', 'authenticated', true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, audience)
    values (v_u, 'home-garden', 'vcr Bad Slug!', 'written', '', 'VCR bad', 'public', 'everyone');
    results := results || (v_i || ' FAIL a malformed Corner slug was saved');
  exception
    when foreign_key_violation then
      results := results || (v_i || ' PASS a malformed Corner slug is still rejected (23503)');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.corners c where c.slug = 'vcr Bad Slug!');
  if v_n <> 0 then results := results || (v_i || ' FAIL a row was made for the malformed slug'); end if;

  -- 6. Unknown Space: still rejected.
  perform set_config('role', 'authenticated', true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, audience)
    values (v_u, 'vcr-no-such-space', 'vcr-thing', 'written', '', 'VCR nospace', 'public', 'everyone');
    results := results || (v_i || ' FAIL a Corner in a Space that does not exist was saved');
  exception
    when foreign_key_violation then
      results := results || (v_i || ' PASS a Corner in a Space that does not exist is still rejected (23503)');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.corners c where c.space_slug = 'vcr-no-such-space');
  if v_n <> 0 then results := results || (v_i || ' FAIL a row was made for the unknown Space'); end if;

  -- 7. No Corner, no row.
  v_n := (select count(*) from public.corners c where c.slug like 'vcr-%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS only the two picked Corners got rows' else ' FAIL ' || v_n || ' vcr- rows, expected 2' end);

  -- 8. Function shape and grants.
  v_n := (select count(*) from pg_proc p
          where p.oid = 'private.posts_ensure_corner()'::regprocedure
            and p.prosecdef
            and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg(setting) where cfg.setting like 'search_path=%'))
       + (case when has_function_privilege('anon', 'private.posts_ensure_corner()', 'execute')
                 or has_function_privilege('authenticated', 'private.posts_ensure_corner()', 'execute') then 0 else 1 end);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS security definer, pinned search_path, no client execute' else ' FAIL ' || v_n || ' of 2' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
