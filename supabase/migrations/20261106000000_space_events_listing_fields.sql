-- Soosh core loop v1, PR 5, fields only: what a host can say about an event.
--
-- Run AFTER 20261105000000_onboarding_taste.sql. Applied only with the founder's written
-- approval naming this file (CLAUDE.md).
--
-- This is the first half of the deferred 20261102000000_space_events_listing.sql (kept in
-- supabase/deferred/). The second half, spaces_with_member_moments(), hid every Space with
-- no member Moments; live has one active Space and it has none, so it is NOT here, and
-- nothing in this file hides a Space. The app already shows every Space when that function
-- does not exist.
--
--   space_events.price (text), capacity (int) and booking_url (text). All three are the
--   host's own words about their own event, shown on the host Space page and the event.
--   Payment happens on the host's page: booking_url is a link out, nothing is collected
--   here. set_event_listing() sets them (hosts and the event's creator, the same rule as
--   update_event), so create_event and update_event keep their signatures and no
--   overloads appear. The first plan's cost line reads price when there is one.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261106000000_space_events_listing_fields.sql.

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
