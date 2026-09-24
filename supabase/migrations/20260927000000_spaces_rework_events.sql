-- Sushii: Spaces Rework — Events. New Space-scoped events: space_events,
-- event_private_details (the exact address, gated the same way
-- space_private_details is), and event_rsvps ("going" is a row, not a
-- status — cancelling an RSVP deletes it).
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260926020000_fix_deletion_expiry.sql.
--
-- Reuses spaces.events_created_by ('hosts' | 'members'), already declared
-- in the Phase 2 schema migration (20260924110000) — not a new column.
-- Reuses public.assert_space_active(uuid) from Phase 4's follow-up
-- (20260926010000) to block new events/RSVPs on a read_only or deleted
-- Space, admins excepted.
--
-- RLS can hide ROWS but not COLUMNS, so a Closed Space's event teasers
-- (title/date, never the address) for a non-member are served by a
-- SECURITY DEFINER function (list_event_teasers) that selects only those
-- four columns, rather than by trying to shape space_events' own SELECT
-- policy to leak partial rows — it can't. space_events' own policy stays a
-- plain full-row gate: admin, or the Space is open, or the caller is an
-- active member. Non-members of a Closed Space get zero rows from
-- space_events directly and are expected to use the teaser function
-- instead.
--
-- All writes go through SECURITY DEFINER RPCs — none of the three new
-- tables gets an INSERT/UPDATE/DELETE policy for authenticated/anon, only
-- SELECT. Every column inside every subquery is fully qualified with its
-- table name throughout, same discipline as every migration since the
-- Phase 3 lesson (a bare column in a correlated subquery silently binds
-- to the wrong table when both tables in scope share that column name).
--
-- Also extends three already-merged Phase 3 functions (leave_space,
-- remove_member, ban_member) to drop a departing member's RSVPs to a
-- Closed Space's upcoming events — spelled out in section 6, not
-- rebuilding the rest of those functions' bodies — and extends Phase 4's
-- execute_space_deletion to clean up event_private_details the same way
-- it already cleans up space_private_details (section 7). space_events
-- and event_rsvps rows themselves are NOT deleted on Space deletion —
-- kept for history, same precedent as space_members, and already hidden
-- from non-admins by space_events' own status <> 'deleted' gate.
--
-- Safe to re-run: table/index/policy creation is idempotent, functions
-- are create-or-replace.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. space_events
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_events (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- IANA name (e.g. 'America/New_York'), display-only — starts_at/ends_at
  -- are the canonical UTC instants either way.
  timezone text not null,
  meets text not null check (meets in ('in_person', 'online', 'both')),
  neighborhood text,
  city text,
  -- Nullable from the start, learning from spaces.created_by's own
  -- NOT NULL / ON DELETE SET NULL contradiction (fixed live, see
  -- 20260926011000) rather than repeating it here.
  created_by uuid references auth.users (id) on delete set null,
  featured boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists space_events_space_idx on public.space_events (space_id, starts_at);
-- At most one featured event per Space. feature_event() proactively
-- un-features the previous one in the same transaction (same shape as
-- space_moments_one_featured) — this index is a backstop, not the primary
-- enforcement.
create unique index if not exists space_events_one_featured
  on public.space_events (space_id) where featured;

alter table public.space_events enable row level security;

drop policy if exists "events follow the space's access" on public.space_events;
create policy "events follow the space's access"
  on public.space_events for select
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1 from spaces s
      where s.id = space_events.space_id
        and s.status <> 'deleted'
        and (s.access = 'open' or public.is_space_member(s.id, auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. event_rsvps — "going" is row-existence, not a status column.
--    Cancelling an RSVP deletes the row outright. Created before
--    event_private_details below, since that table's policy references
--    this one.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.event_rsvps (
  event_id bigint not null references public.space_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_rsvps_user_idx on public.event_rsvps (user_id);
alter table public.event_rsvps enable row level security;

drop policy if exists "you and the space's members read RSVPs" on public.event_rsvps;
create policy "you and the space's members read RSVPs"
  on public.event_rsvps for select to authenticated
  using (
    event_rsvps.user_id = auth.uid()
    or private.is_admin(auth.uid())
    or exists (
      select 1 from space_events se
      where se.id = event_rsvps.event_id and public.is_space_member(se.space_id, auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. event_private_details — same shape and same reasoning as
--    space_private_details: the exact address is never selected by a
--    query that also returns rows to people who shouldn't see it, so it
--    lives on its own table with its own, narrower policy. Readable by an
--    active Space member, or by anyone with a "going" RSVP for that
--    specific event (an Open Space's RSVP'd non-member, in particular).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.event_private_details (
  event_id bigint primary key references public.space_events (id) on delete cascade,
  exact_address text not null
);
alter table public.event_private_details enable row level security;

drop policy if exists "members and going RSVPs read the exact address" on public.event_private_details;
create policy "members and going RSVPs read the exact address"
  on public.event_private_details for select to authenticated
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1 from space_events se
      where se.id = event_private_details.event_id
        and public.is_space_member(se.space_id, auth.uid())
    )
    or exists (
      select 1 from event_rsvps er
      where er.event_id = event_private_details.event_id and er.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Write RPCs.
-- ─────────────────────────────────────────────────────────────────────────

-- Who may create: hosts only, or any active member, per this Space's own
-- events_created_by setting (a host is always an active member too, so
-- the 'members' branch already covers hosts without a separate check).
-- starts_at must be in the future at creation time — not re-checked on
-- update_event, and not a table CHECK (now() drifts on every future
-- UPDATE, which would start rejecting unrelated edits to an event whose
-- start time has since passed).
create or replace function public.create_event(
  p_space_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_meets text,
  p_neighborhood text,
  p_city text,
  p_exact_address text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting text;
  v_event_id bigint;
begin
  select spaces.events_created_by into v_setting from spaces where spaces.id = p_space_id;
  if v_setting is null then
    raise exception 'That Space doesn''t exist.';
  end if;
  if v_setting = 'hosts' then
    if not public.is_space_host(p_space_id, auth.uid()) then
      raise exception 'Only a host can create an event in this Space.';
    end if;
  else
    if not public.is_space_member(p_space_id, auth.uid()) then
      raise exception 'Only a member can create an event in this Space.';
    end if;
  end if;
  perform public.assert_space_active(p_space_id);
  if p_starts_at <= now() then
    raise exception 'An event''s start time must be in the future.';
  end if;

  insert into space_events (space_id, title, description, starts_at, ends_at, timezone, meets, neighborhood, city, created_by)
  values (p_space_id, p_title, p_description, p_starts_at, p_ends_at, p_timezone, p_meets, p_neighborhood, p_city, auth.uid())
  returning id into v_event_id;

  if p_exact_address is not null then
    insert into event_private_details (event_id, exact_address) values (v_event_id, p_exact_address);
  end if;

  return v_event_id;
end;
$$;
revoke all on function public.create_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.create_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, text) to authenticated;

-- Host, or the event's own creator while still an active member (a
-- departed creator can no longer edit; only a host can from then on).
-- Not a teardown action, so it's gated on the Space being active, same as
-- create_event.
create or replace function public.update_event(
  p_event_id bigint,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_meets text,
  p_neighborhood text,
  p_city text,
  p_exact_address text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not (
    public.is_space_host(v_event.space_id, auth.uid())
    or (v_event.created_by = auth.uid() and public.is_space_member(v_event.space_id, auth.uid()))
  ) then
    raise exception 'Only a host or this event''s creator can edit it.';
  end if;
  perform public.assert_space_active(v_event.space_id);

  update space_events
  set title = p_title, description = p_description, starts_at = p_starts_at, ends_at = p_ends_at,
      timezone = p_timezone, meets = p_meets, neighborhood = p_neighborhood, city = p_city
  where space_events.id = p_event_id;

  if p_exact_address is null then
    delete from event_private_details where event_private_details.event_id = p_event_id;
  else
    insert into event_private_details (event_id, exact_address) values (p_event_id, p_exact_address)
    on conflict (event_id) do update set exact_address = excluded.exact_address;
  end if;
end;
$$;
revoke all on function public.update_event(bigint, text, text, timestamptz, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.update_event(bigint, text, text, timestamptz, timestamptz, text, text, text, text, text) to authenticated;

-- Host, or the event's own creator while still an active member — same
-- permission shape as update_event. A teardown action, so NOT gated on
-- the Space being active (cancelling an event in a read_only or even
-- deleted Space must still work). Notifies every current RSVP by writing
-- one notifications row each; href is left null since the new-style
-- Space page doesn't exist yet (the app's existing /space/:slug route is
-- the OLD Category-feed page, unrelated to this feature — do not reuse
-- it). Fill in a real href once that page ships.
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
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || v_event.title || '.', null, v_actor_name
  from event_rsvps
  where event_rsvps.event_id = p_event_id;
end;
$$;
revoke all on function public.cancel_event(bigint) from public, anon;
grant execute on function public.cancel_event(bigint) to authenticated;

-- Host only. Proactively un-features any other featured event in the same
-- Space first — space_events_one_featured is the backstop, not the
-- primary mechanism. Gated on the Space being active: featuring is host
-- curation of a Space's public presentation, the same class of action
-- Phase 4's follow-up gated for approve_join_request/invite_host/etc.
create or replace function public.feature_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not public.is_space_host(v_event.space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'Only a scheduled event can be featured.';
  end if;
  perform public.assert_space_active(v_event.space_id);

  update space_events set featured = false
  where space_events.space_id = v_event.space_id and space_events.featured and space_events.id <> p_event_id;
  update space_events set featured = true where space_events.id = p_event_id;
end;
$$;
revoke all on function public.feature_event(bigint) from public, anon;
grant execute on function public.feature_event(bigint) to authenticated;

create or replace function public.unfeature_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_events.space_id into v_space_id from space_events where space_events.id = p_event_id;
  if v_space_id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not public.is_space_host(v_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  update space_events set featured = false where space_events.id = p_event_id;
end;
$$;
revoke all on function public.unfeature_event(bigint) from public, anon;
grant execute on function public.unfeature_event(bigint) to authenticated;

-- Open Space: any signed-in user. Closed: active members only. Gated on
-- the Space being active (new engagement) and the event still being
-- scheduled.
create or replace function public.rsvp_to_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_access text;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'This event has been cancelled.';
  end if;
  select spaces.access into v_access from spaces where spaces.id = v_event.space_id;
  if v_access = 'closed' and not public.is_space_member(v_event.space_id, auth.uid()) then
    raise exception 'Only a member of this Space can RSVP.';
  end if;
  perform public.assert_space_active(v_event.space_id);

  insert into event_rsvps (event_id, user_id) values (p_event_id, auth.uid())
  on conflict (event_id, user_id) do nothing;
end;
$$;
revoke all on function public.rsvp_to_event(bigint) from public, anon;
grant execute on function public.rsvp_to_event(bigint) to authenticated;

-- Self-service, a teardown action — not gated on the Space being active,
-- same reasoning as cancel_event.
create or replace function public.cancel_rsvp(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from event_rsvps where event_rsvps.event_id = p_event_id and event_rsvps.user_id = auth.uid();
  if not found then
    raise exception 'You aren''t RSVPed to this event.';
  end if;
end;
$$;
revoke all on function public.cancel_rsvp(bigint) from public, anon;
grant execute on function public.cancel_rsvp(bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Teasers — the only way a Closed Space's non-member sees anything
--    about its events: title + starts_at + timezone, never the address,
--    never a description. Bypasses RLS deliberately (that's the whole
--    point — RLS can't return a partial row), so it re-implements the
--    "not deleted, unless admin" gate space_events' own policy has, since
--    nothing else does that for it here.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.list_event_teasers(p_space_id uuid)
returns table (id bigint, title text, starts_at timestamptz, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select se.id, se.title, se.starts_at, se.timezone
  from space_events se
  join spaces s on s.id = se.space_id
  where se.space_id = p_space_id
    and se.status = 'scheduled'
    and se.starts_at > now()
    and (s.status <> 'deleted' or private.is_admin(auth.uid()))
  order by se.starts_at;
$$;
revoke all on function public.list_event_teasers(uuid) from public;
grant execute on function public.list_event_teasers(uuid) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Membership-exit cleanup, Closed Spaces only: a departing/removed
--    member's RSVPs to that Space's upcoming events are deleted. An Open
--    Space's RSVPs never depended on membership in the first place, so
--    leaving one doesn't change RSVP eligibility. Full bodies reproduced
--    (create or replace replaces the whole function) — only the new
--    final DELETE in each is new here; everything above it is the
--    existing Phase 3 body, untouched.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active_hosts int;
begin
  select role into v_role from space_members
  where space_id = p_space_id and user_id = auth.uid() and status = 'active';
  if v_role is null then
    raise exception 'You''re not a member of this Space.';
  end if;
  if v_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else before you leave.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = auth.uid();
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = auth.uid();
  delete from event_rsvps er
  using space_events se
  where er.event_id = se.id
    and se.space_id = p_space_id
    and er.user_id = auth.uid()
    and se.starts_at > now()
    and exists (select 1 from spaces s where s.id = p_space_id and s.access = 'closed');
end;
$$;
revoke all on function public.leave_space(uuid) from public, anon;
grant execute on function public.leave_space(uuid) to authenticated;

create or replace function public.remove_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_active_hosts int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  select role into v_target_role from space_members
  where space_id = p_space_id and user_id = p_user_id and status = 'active';
  if v_target_role is null then
    raise exception 'That person isn''t an active member.';
  end if;
  if v_target_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else first.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = p_user_id;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
  delete from event_rsvps er
  using space_events se
  where er.event_id = se.id
    and se.space_id = p_space_id
    and er.user_id = p_user_id
    and se.starts_at > now()
    and exists (select 1 from spaces s where s.id = p_space_id and s.access = 'closed');
end;
$$;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

create or replace function public.ban_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = p_user_id and role = 'host') then
    raise exception 'Demote them as a host (demote_host) before banning them.';
  end if;
  update space_members set status = 'banned' where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t in this Space.';
  end if;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
  delete from event_rsvps er
  using space_events se
  where er.event_id = se.id
    and se.space_id = p_space_id
    and er.user_id = p_user_id
    and se.starts_at > now()
    and exists (select 1 from spaces s where s.id = p_space_id and s.access = 'closed');
end;
$$;
revoke all on function public.ban_member(uuid, uuid) from public, anon;
grant execute on function public.ban_member(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Deletion cleanup: event_private_details deleted outright on Space
--    deletion, same reasoning as space_private_details ("no history value
--    in a stale exact address"). space_events/event_rsvps rows are
--    deliberately left in place — kept for history, same precedent as
--    space_members, and already hidden from non-admins by space_events'
--    own status <> 'deleted' gate on its parent Space. Full body
--    reproduced from 20260926000000; only the new final DELETE is new.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.execute_space_deletion(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;
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
-- Run supabase/verification/events_check.sql.
