-- Rollback for 20261102000000_space_events_listing.sql.
-- Drops the two functions and the three space_events columns (the price, capacity
-- and booking link hosts entered are lost).

drop function if exists public.spaces_with_member_moments(uuid[]);
drop function if exists public.set_event_listing(bigint, text, integer, text);

alter table public.space_events
  drop column if exists booking_url,
  drop column if exists capacity,
  drop column if exists price;
