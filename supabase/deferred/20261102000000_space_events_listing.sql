-- Soosh core loop v1, PR 5: what a host can say about an event, and which Spaces have member Moments.
--
-- Run AFTER 20261101000000_moment_audience_and_stubs.sql. Not applied until the
-- founder approves this file by name (CLAUDE.md).
--
--   1. space_events.price (text), capacity (int) and booking_url (text). All three
--      are the host's own words about their own event, shown on the host Space page
--      and the event. Payment happens on the host's page: booking_url is a link out,
--      nothing is collected here. A new function sets them (hosts and the event's
--      creator, the same rule as update_event), so create_event and update_event keep
--      their signatures and no overloads appear.
--   2. spaces_with_member_moments(uuid[]): which of the given Spaces have at least one
--      approved Moment posted by someone who is not a host of that Space. Discover,
--      Corner pages and Search hide a Space that has none. It returns Space ids only,
--      never Moments or people, so it is safe to call for any visitor.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261102000000_space_events_listing.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. space_events: price, capacity, booking_url
-- ─────────────────────────────────────────────────────────────────────────
alter table public.space_events
  add column price text check (price is null or char_length(price) between 1 and 40),
  add column capacity integer check (capacity is null or capacity between 1 and 1000),
  add column booking_url text check (booking_url is null or (char_length(booking_url) <= 500 and booking_url ~* '^https://[^[:space:]]+$'));

create function public.set_event_listing(
  p_event_id bigint,
  p_price text,
  p_capacity integer,
  p_booking_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space uuid;
  v_creator uuid;
begin
  select e.space_id, e.created_by into v_space, v_creator
  from public.space_events e
  where e.id = p_event_id;
  if v_space is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not (
    public.is_space_host(v_space, (select auth.uid()))
    or (v_creator = (select auth.uid()) and public.is_space_member(v_space, (select auth.uid())))
  ) then
    raise exception 'Only a host or this event''s creator can edit it.' using errcode = '42501';
  end if;
  perform public.assert_space_active(v_space);

  update public.space_events e
  set price = nullif(btrim(p_price), ''),
      capacity = p_capacity,
      booking_url = nullif(btrim(p_booking_url), '')
  where e.id = p_event_id;
end;
$$;
revoke all on function public.set_event_listing(bigint, text, integer, text) from public, anon;
grant execute on function public.set_event_listing(bigint, text, integer, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. spaces_with_member_moments
-- ─────────────────────────────────────────────────────────────────────────
create function public.spaces_with_member_moments(p_space_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct sm.space_id), '{}'::uuid[])
  from public.space_moments sm
  join public.posts p on p.id = sm.post_id
  join public.spaces s on s.id = sm.space_id
  where sm.space_id = any (p_space_ids)
    and sm.status = 'approved'
    and sm.removed_by_host = false
    and s.status = 'active'
    and p.visibility <> 'just_me'
    and not exists (
      select 1
      from public.space_members h
      where h.space_id = sm.space_id
        and h.user_id = p.user_id
        and h.role = 'host'
        and h.status = 'active'
    );
$$;
revoke all on function public.spaces_with_member_moments(uuid[]) from public;
grant execute on function public.spaces_with_member_moments(uuid[]) to authenticated, anon;
