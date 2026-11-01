-- Rollback for 20261114000000_calendar_feed.sql.
-- Drops the function and the table, so every subscribe link stops working (the feed answers 404 and
-- calendars keep what they already have). The app hides "Copy subscribe link" when the table is missing.

drop function if exists public.set_calendar_feed_token(text);
drop table if exists public.calendar_feed_tokens;
