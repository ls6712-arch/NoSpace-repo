-- Rollback for 20261108000000_stubby_deck.sql. Picks and asks stay; only the two flags go.

alter table public.personal_picks drop column if exists better_with_friend;
alter table public.stubby_asks drop column if exists free_follow_up_used;
