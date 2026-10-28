-- Soosh core loop v1, PR 5: space_events price/capacity/booking_url and
-- spaces_with_member_moments().
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261102000000_space_events_listing.sql. Run before it, the script stops at
-- the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling (23514 check,
-- 42501 privilege, P0001 raised message); anything else is recorded as
-- 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   HOST …8001, MEMBER …8002, OTHER …8003 (a member who is not the event's creator),
--   STRANGER …8004; Spaces …00a1 (open), …00a2 (open, only host posts), …00a3 (open, no
--   Moments), …00a4 (read_only).
-- Every count and lookup is scoped to those ids, never to a whole live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_event bigint;
  v_ids uuid[];
  v_p_member bigint;
  v_p_host bigint;
  v_p_pending bigint;
  v_p_removed bigint;
  v_p_private bigint;
  v_host uuid := '00000000-0000-4000-8000-000000008001';
  v_member uuid := '00000000-0000-4000-8000-000000008002';
  v_other uuid := '00000000-0000-4000-8000-000000008003';
  v_stranger uuid := '00000000-0000-4000-8000-000000008004';
  v_a uuid := '00000000-0000-4000-8000-0000000000a1';
  v_b uuid := '00000000-0000-4000-8000-0000000000a2';
  v_c uuid := '00000000-0000-4000-8000-0000000000a3';
  v_d uuid := '00000000-0000-4000-8000-0000000000a4';
begin
  v_owner_role := current_user;

  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'space_events' and c.column_name = 'booking_url'
  ) or to_regprocedure('public.spaces_with_member_moments(uuid[])') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261102000000_space_events_listing.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sl-host@sl-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sl-member@sl-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sl-other@sl-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sl-stranger@sl-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, created_by, status)
  values
    (v_a, 'sl-check-a', 'SL check A', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_host, 'active'),
    (v_b, 'sl-check-b', 'SL check B', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_host, 'active'),
    (v_c, 'sl-check-c', 'SL check C', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_host, 'active'),
    (v_d, 'sl-check-d', 'SL check D', 'Test fixture, rolled back.', 'https://example.invalid/c.jpg', 'in_person', 'open', 'immediate', v_host, 'read_only');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    (v_a, v_host, 'host', 'active', now() - interval '30 days'),
    (v_a, v_member, 'member', 'active', now() - interval '20 days'),
    (v_a, v_other, 'member', 'active', now() - interval '20 days'),
    (v_b, v_host, 'host', 'active', now() - interval '30 days'),
    (v_c, v_host, 'host', 'active', now() - interval '30 days'),
    (v_d, v_host, 'host', 'active', now() - interval '30 days'),
    (v_d, v_member, 'member', 'active', now() - interval '20 days');

  -- Event created by MEMBER (so OTHER is a member who did not create it).
  insert into public.space_events (space_id, title, starts_at, ends_at, timezone, meets, created_by, status)
  values (v_a, 'SL check event', now() + interval '3 days', now() + interval '4 days', 'UTC', 'in_person', v_member, 'scheduled');
  v_event := (select e.id from public.space_events e where e.space_id = v_a and e.title = 'SL check event');

  -- ── set_event_listing ───────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);

  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Rs 1,200', 8, 'https://example.com/book');
    v_n := (select count(*) from public.space_events e where e.id = v_event and e.price = 'Rs 1,200' and e.capacity = 8 and e.booking_url = 'https://example.com/book');
    results := array_append(results, case when v_n = 1 then format('%s PASS (a host sets price, capacity and booking link)', v_i)
                                          else format('%s FAIL (stored %s rows)', v_i, v_n) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Free', 8, 'http://example.com/book');
    results := array_append(results, format('%s FAIL (an http link was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (a link that is not https is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Free', 0, null);
    results := array_append(results, format('%s FAIL (capacity 0 was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (capacity must be at least 1)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, repeat('x', 41), 8, null);
    results := array_append(results, format('%s FAIL (a 41-character price was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (a price over 40 characters is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, '   ', null, '  ');
    v_n := (select count(*) from public.space_events e where e.id = v_event and e.price is null and e.capacity is null and e.booking_url is null);
    results := array_append(results, case when v_n = 1 then format('%s PASS (blank text clears price and link)', v_i)
                                          else format('%s FAIL (not cleared)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Free', 4, null);
    results := array_append(results, format('%s PASS (the event''s creator, a member, can set them)', v_i));
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Hijack', 1, null);
    results := array_append(results, format('%s FAIL (another member changed it)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member who did not create it is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Hijack', 1, null);
    results := array_append(results, format('%s FAIL (a stranger changed it)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a stranger is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform public.set_event_listing(v_event, 'Hijack', 1, null);
    results := array_append(results, format('%s FAIL (anon ran it)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot run it)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.space_events e where e.id = v_event and e.price = 'Free' and e.capacity = 4);
  results := array_append(results, case when v_n = 1 then format('%s PASS (the refused calls changed nothing)', v_i)
                                        else format('%s FAIL (the event was changed)', v_i) end);

  -- ── spaces_with_member_moments ──────────────────────────────────────────
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility) values
    (v_member, 'check-hobby', 'written', '', 'sl member', 'public'),
    (v_host, 'check-hobby', 'written', '', 'sl host', 'public'),
    (v_member, 'check-hobby', 'written', '', 'sl pending', 'public'),
    (v_member, 'check-hobby', 'written', '', 'sl removed', 'public'),
    (v_member, 'check-hobby', 'written', '', 'sl private', 'just_me');
  v_p_member := (select x.id from public.posts x where x.user_id = v_member and x.caption = 'sl member');
  v_p_host := (select x.id from public.posts x where x.user_id = v_host and x.caption = 'sl host');
  v_p_pending := (select x.id from public.posts x where x.user_id = v_member and x.caption = 'sl pending');
  v_p_removed := (select x.id from public.posts x where x.user_id = v_member and x.caption = 'sl removed');
  v_p_private := (select x.id from public.posts x where x.user_id = v_member and x.caption = 'sl private');

  -- A: a member Moment (approved). B: only the host's own. C: none. D (read only): a member Moment.
  insert into public.space_moments (space_id, post_id, status, removed_by_host) values
    (v_a, v_p_member, 'approved', false),
    (v_b, v_p_host, 'approved', false),
    (v_d, v_p_member, 'approved', false);

  v_ids := public.spaces_with_member_moments(array[v_a, v_b, v_c, v_d]);
  v_i := v_i + 1;
  results := array_append(results, case when v_a = any (v_ids) then format('%s PASS (a Space with an approved member Moment is listed)', v_i)
                                        else format('%s FAIL (A missing)', v_i) end);
  v_i := v_i + 1;
  results := array_append(results, case when not (v_b = any (v_ids)) then format('%s PASS (a Space with only the host''s own Moments is not listed)', v_i)
                                        else format('%s FAIL (B listed)', v_i) end);
  v_i := v_i + 1;
  results := array_append(results, case when not (v_c = any (v_ids)) then format('%s PASS (a Space with no Moments is not listed)', v_i)
                                        else format('%s FAIL (C listed)', v_i) end);
  v_i := v_i + 1;
  results := array_append(results, case when not (v_d = any (v_ids)) then format('%s PASS (a read-only Space is not listed)', v_i)
                                        else format('%s FAIL (D listed)', v_i) end);

  -- Pending, removed and private member Moments do not count, in a Space that has nothing else.
  insert into public.space_moments (space_id, post_id, status, removed_by_host) values
    (v_c, v_p_pending, 'pending', false),
    (v_c, v_p_removed, 'approved', true),
    (v_c, v_p_private, 'approved', false);
  v_ids := public.spaces_with_member_moments(array[v_c]);
  v_i := v_i + 1;
  results := array_append(results, case when cardinality(v_ids) = 0 then format('%s PASS (pending, removed and just-me Moments do not count)', v_i)
                                        else format('%s FAIL (C listed with %s)', v_i, cardinality(v_ids)) end);

  v_i := v_i + 1;
  results := array_append(results, case when cardinality(public.spaces_with_member_moments('{}'::uuid[])) = 0 then format('%s PASS (an empty list gives an empty list)', v_i)
                                        else format('%s FAIL', v_i) end);

  -- Anyone can ask; it returns Space ids only.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_ids := public.spaces_with_member_moments(array[v_a, v_b]);
    results := array_append(results, case when v_ids = array[v_a] then format('%s PASS (anon can ask and gets Space ids only)', v_i)
                                          else format('%s FAIL (anon got %s ids)', v_i, cardinality(v_ids)) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
