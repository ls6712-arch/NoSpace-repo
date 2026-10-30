-- Rollback for 20261106000000_space_events_listing_fields.sql.
-- Drops set_event_listing() and the three space_events columns (the price, capacity
-- and booking link hosts entered are lost).

drop function if exists public.set_event_listing(bigint, text, integer, text);

alter table public.space_events
  drop column if exists booking_url,
  drop column if exists capacity,
  drop column if exists price;
