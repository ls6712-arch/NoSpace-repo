-- Sushii: Spaces Rework Phase 5 — Create Space / Edit Space / Space page
-- backend. No schema changes; new and redefined functions only.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260927000000_spaces_rework_events.sql (and its two
--   follow-up migrations).
--
-- 1. create_space / update_space (new): the only way a Space gets made or
--    edited going forward — friendly pre-checks (blocklist, reserved slug,
--    duplicate slug, an in-person Space needs a neighborhood and city,
--    the creation limit from app_config) before ever hitting a raw
--    constraint violation, 1-3 Corners linked in the same transaction
--    (first = primary), creator auto-added as founding host. The exact
--    address goes into space_private_details, same null-means-keep /
--    p_clear_address-means-delete convention as update_event. Switching
--    access from closed to open with requests still pending is refused —
--    resolve them first. Slug and Corner membership aren't editable here
--    — space_corners already has its own "hosts manage their space's
--    corners" policy for direct table access, so Corner add/remove
--    doesn't need a function. The creation limit itself counts every
--    Space created in a rolling 30 days, deleted ones included, so a
--    create/delete/re-create cycle can't be used to bypass it.
--
-- 2. request_or_join_space (redefined): the optional-message/optional-
--    Moment "Request to join" flow. Validates an attached Moment belongs
--    to the caller and is public before it's ever stored. Drops the old
--    join-questions requirement branch entirely — no UI has ever set
--    spaces.join_questions (Phase 5's Create Space form doesn't expose
--    it, by this phase's own product decision), so no live Space can
--    trigger it; removing it now rather than leaving dead code that the
--    next reader has to puzzle over.
--
-- 3. space_moment_count_30d (new): "N Moments this month" needs a
--    SECURITY DEFINER function, not a client-side count of space_moments
--    directly — a Closed Space's Moments are RLS-hidden from non-members
--    by design, so a plain count() from the client would silently read 0
--    for them instead of the real number. Admin-excepted on deleted
--    Spaces, same as everywhere else.
--
-- 4. cancel_event / execute_space_deletion (redefined): cancel_event's
--    notification gets a real href now that the Space page exists
--    (/space/<slug>?tab=events, matching Discover's own ?tab= convention).
--    execute_space_deletion's notification — a side effect of the Space
--    itself disappearing, not a host's decision — gets a different
--    message ("[title] was cancelled because its Space closed.") and no
--    href, since there's nothing left to link to that a non-admin could
--    open. Both truncate the embedded event title to 200 chars
--    (space_events.title has no length limit of its own, and
--    notifications' own enforce_notification_insert trigger rejects any
--    body over 300 — a long enough title would otherwise fail the write
--    outright, silently dropping the notification).
--
-- enforce_notification_insert also needs 'space_event_cancelled' added to
-- its allowed-kinds list (already fixed live) — staged as a separate,
-- immediately-following migration once its current definition is in hand,
-- rather than guessed at here.
--
-- Every column inside every subquery is fully qualified throughout, same
-- discipline as every migration since the Phase 3 lesson.
--
-- Safe to re-run: functions are create-or-replace throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. create_space / update_space
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.create_space(
  p_slug text,
  p_name text,
  p_description text,
  p_cover_image text,
  p_meets text,
  p_access text,
  p_posting_mode text,
  p_events_created_by text,
  p_corner_ids bigint[],
  p_neighborhood text default null,
  p_city text default null,
  p_member_cap int default null,
  p_rules text default null,
  p_exact_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit_config jsonb;
  v_established_after int;
  v_limit int;
  v_created_count int;
  v_account_created timestamptz;
  v_space_id uuid;
  v_corner_count int;
  v_i int := 0;
  v_corner_id bigint;
begin
  if p_corner_ids is null or coalesce(array_length(p_corner_ids, 1), 0) < 1 then
    raise exception 'Pick at least 1 Corner.';
  end if;
  if array_length(p_corner_ids, 1) > 3 then
    raise exception 'A Space can have at most 3 Corners.';
  end if;
  if array_length(p_corner_ids, 1) <> (select count(distinct x) from unnest(p_corner_ids) as x) then
    raise exception 'Pick 3 different Corners.';
  end if;
  select count(*) into v_corner_count from corners where corners.id = any(p_corner_ids);
  if v_corner_count <> array_length(p_corner_ids, 1) then
    raise exception 'One of those Corners doesn''t exist.';
  end if;

  if p_meets in ('in_person', 'both') and (coalesce(trim(p_neighborhood), '') = '' or coalesce(trim(p_city), '') = '') then
    raise exception 'An in-person Space needs a neighborhood and city.';
  end if;

  if public.is_blocklisted_name(p_name) then
    raise exception 'That name isn''t available.';
  end if;
  if public.is_reserved_space_slug(p_slug) then
    raise exception 'That URL isn''t available.';
  end if;
  if exists (select 1 from spaces where spaces.slug = p_slug) then
    raise exception 'That URL is already taken.';
  end if;

  select app_config.value into v_limit_config from app_config where app_config.key = 'space_creation_limit';
  v_established_after := coalesce((v_limit_config->>'established_after_days')::int, 30);
  select auth.users.created_at into v_account_created from auth.users where auth.users.id = auth.uid();
  -- A rolling 30-day window, deleted Spaces included — counting only
  -- current non-deleted Spaces would let a create/delete/re-create cycle
  -- bypass the limit entirely.
  select count(*) into v_created_count
  from spaces where spaces.created_by = auth.uid() and spaces.created_at > now() - interval '30 days';

  if v_account_created is not null and v_account_created <= now() - make_interval(days => v_established_after) then
    v_limit := coalesce((v_limit_config->>'established')::int, 5);
  else
    v_limit := coalesce((v_limit_config->>'new_account')::int, 1);
  end if;

  if v_created_count >= v_limit then
    raise exception 'You''ve reached your limit of % Space%.', v_limit, case when v_limit = 1 then '' else 's' end;
  end if;

  insert into spaces (slug, name, description, cover_image, meets, neighborhood, city, access, member_cap, posting_mode, events_created_by, rules, created_by)
  values (p_slug, p_name, p_description, p_cover_image, p_meets, p_neighborhood, p_city, p_access, p_member_cap, p_posting_mode, p_events_created_by, p_rules, auth.uid())
  returning id into v_space_id;

  insert into space_members (space_id, user_id, role, status)
  values (v_space_id, auth.uid(), 'host', 'active');

  foreach v_corner_id in array p_corner_ids loop
    v_i := v_i + 1;
    insert into space_corners (space_id, corner_id, is_primary) values (v_space_id, v_corner_id, v_i = 1);
  end loop;

  if p_exact_address is not null then
    insert into space_private_details (space_id, exact_address) values (v_space_id, p_exact_address);
  end if;

  return v_space_id;
end;
$$;
revoke all on function public.create_space(text, text, text, text, text, text, text, text, bigint[], text, text, int, text, text) from public, anon;
grant execute on function public.create_space(text, text, text, text, text, text, text, text, bigint[], text, text, int, text, text) to authenticated;

-- Slug isn't editable (it's a stable identifier once shared/linked to) and
-- Corner membership goes through space_corners' own policy directly, not
-- here. Gated on the Space being active: a read_only Space has no active
-- host by construction (that's the only way it got into read_only — see
-- start_host_handoff_if_last_host), so is_space_host below already refuses
-- one implicitly; assert_space_active additionally covers a deleted
-- Space, whose host rows are kept and would otherwise still pass that
-- check.
--
-- p_exact_address follows update_event's own convention: null keeps
-- whatever's already stored, p_clear_address deletes it explicitly.
--
-- Switching access from closed to open while requests are still pending
-- is refused outright — the host has to resolve every one (approve or
-- decline, both already self-service via approve_join_request/
-- decline_join_request) before an Open Space's "anyone can join" rule
-- makes the whole idea of a pending request moot.
create or replace function public.update_space(
  p_space_id uuid,
  p_name text,
  p_description text,
  p_cover_image text,
  p_meets text,
  p_access text,
  p_posting_mode text,
  p_events_created_by text,
  p_neighborhood text default null,
  p_city text default null,
  p_member_cap int default null,
  p_rules text default null,
  p_exact_address text default null,
  p_clear_address boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_access text;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if public.is_blocklisted_name(p_name) then
    raise exception 'That name isn''t available.';
  end if;
  if p_meets in ('in_person', 'both') and (coalesce(trim(p_neighborhood), '') = '' or coalesce(trim(p_city), '') = '') then
    raise exception 'An in-person Space needs a neighborhood and city.';
  end if;
  perform public.assert_space_active(p_space_id);

  select spaces.access into v_current_access from spaces where spaces.id = p_space_id;
  if v_current_access = 'closed' and p_access = 'open' and exists (
    select 1 from space_join_requests where space_join_requests.space_id = p_space_id
  ) then
    raise exception 'Approve or decline pending requests first.';
  end if;

  update spaces
  set name = p_name, description = p_description, cover_image = p_cover_image, meets = p_meets,
      neighborhood = p_neighborhood, city = p_city, access = p_access, member_cap = p_member_cap,
      posting_mode = p_posting_mode, events_created_by = p_events_created_by, rules = p_rules
  where spaces.id = p_space_id;

  if p_clear_address then
    delete from space_private_details where space_private_details.space_id = p_space_id;
  elsif p_exact_address is not null then
    insert into space_private_details (space_id, exact_address) values (p_space_id, p_exact_address)
    on conflict (space_id) do update set exact_address = excluded.exact_address;
  end if;
end;
$$;
revoke all on function public.update_space(uuid, text, text, text, text, text, text, text, text, text, int, text, text, boolean) from public, anon;
grant execute on function public.update_space(uuid, text, text, text, text, text, text, text, text, text, int, text, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. request_or_join_space — redefined. Full body reproduced from
--    20260925000000; the join-questions branch is gone, and an attached
--    Moment (p_join_answers->>'post_id') is validated before it's stored.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.request_or_join_space(p_space_id uuid, p_join_answers jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
  v_active_count int;
  v_post_id bigint;
begin
  select * into v_space from spaces where spaces.id = p_space_id and spaces.status = 'active';
  if v_space.id is null then
    raise exception 'That Space doesn''t exist.';
  end if;

  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'banned') then
    raise exception 'You can''t join this Space.';
  end if;
  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'active') then
    raise exception 'You''re already a member.';
  end if;
  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'pending') then
    raise exception 'You already have a request pending.';
  end if;

  select count(*) into v_active_count from space_members where space_members.space_id = p_space_id and space_members.status = 'active';
  if v_space.member_cap is not null and v_active_count >= v_space.member_cap then
    raise exception 'This Space is full.';
  end if;

  if p_join_answers is not null and (p_join_answers->>'post_id') is not null then
    v_post_id := (p_join_answers->>'post_id')::bigint;
    if not exists (
      select 1 from posts where posts.id = v_post_id and posts.user_id = auth.uid() and posts.visibility = 'public'
    ) then
      raise exception 'That Moment isn''t yours, or isn''t public.';
    end if;
  end if;

  if v_space.access = 'open' then
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'active');
    return 'active';
  else
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'pending');
    insert into space_join_requests (space_id, user_id, answers)
    values (p_space_id, auth.uid(), p_join_answers);
    return 'pending';
  end if;
end;
$$;
revoke all on function public.request_or_join_space(uuid, jsonb) from public, anon;
grant execute on function public.request_or_join_space(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. space_moment_count_30d — "N Moments this month" for the Space
--    header, bypassing space_moments' own RLS on purpose (a Closed
--    Space's real count isn't sensitive the way its actual Moments are).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.space_moment_count_30d(p_space_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from space_moments sm
  join spaces s on s.id = sm.space_id
  where sm.space_id = p_space_id
    and sm.status = 'approved'
    and sm.removed_by_host = false
    and sm.added_at > now() - interval '30 days'
    and (s.status <> 'deleted' or private.is_admin(auth.uid()));
$$;
revoke all on function public.space_moment_count_30d(uuid) from public;
grant execute on function public.space_moment_count_30d(uuid) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. cancel_event / execute_space_deletion — real hrefs, and a different
--    message for a deletion-triggered cancellation. Full bodies
--    reproduced from 20260927000000/21ef12b's versions.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_actor_name text;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not (
    public.is_space_host(v_event.space_id, auth.uid())
    or (v_event.created_by = auth.uid() and public.is_space_member(v_event.space_id, auth.uid()))
  ) then
    raise exception 'Only a host or this event''s creator can cancel it.';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'This event is already cancelled.';
  end if;

  update space_events set status = 'cancelled', featured = false where space_events.id = p_event_id;

  select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
    into v_actor_name from profiles where profiles.id = auth.uid();

  insert into notifications (user_id, kind, body, href, actor_name)
  select event_rsvps.user_id, 'space_event_cancelled',
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || left(v_event.title, 200) || '.',
    '/space/' || (select spaces.slug from spaces where spaces.id = v_event.space_id) || '?tab=events',
    v_actor_name
  from event_rsvps
  where event_rsvps.event_id = p_event_id;
end;
$$;
revoke all on function public.cancel_event(bigint) from public, anon;
grant execute on function public.cancel_event(bigint) to authenticated;

create or replace function public.execute_space_deletion(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;

  insert into notifications (user_id, kind, body, href, actor_name)
  select er.user_id, 'space_event_cancelled',
    left(se.title, 200) || ' was cancelled because its Space closed.', null, null
  from space_events se
  join event_rsvps er on er.event_id = se.id
  where se.space_id = p_space_id and se.status = 'scheduled' and se.starts_at > now();

  update space_events set status = 'cancelled', featured = false
  where space_events.space_id = p_space_id and space_events.status = 'scheduled' and space_events.starts_at > now();

  delete from space_moments where space_moments.space_id = p_space_id;
  delete from space_private_details where space_private_details.space_id = p_space_id;
  delete from space_join_requests where space_join_requests.space_id = p_space_id;
  delete from space_host_invites
  where space_host_invites.space_id = p_space_id and space_host_invites.status = 'invited';
  delete from event_private_details
  using space_events se
  where event_private_details.event_id = se.id and se.space_id = p_space_id;
end;
$$;
revoke all on function public.execute_space_deletion(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- Run supabase/verification/phase5_backend_check.sql.
