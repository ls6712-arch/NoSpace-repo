-- Why each of Stubby's candidates was dropped, saved with the ask, for debugging
-- (live test, Nov 2, 2026: ask 9 found 1 and kept 0, and nothing said why).
--
--   stubby_asks.drop_reasons   A list of {"title", "reason"}: the event's title as the search found it
--                              (80 characters at most) and the fixed reason the code dropped it. Never
--                              the text of the ask. At most 40 entries; the function saves at most 30.
--
-- stubby_asks keeps its rules: a person can read only their own asks (the app counts asks left
-- that way), so only their own drop reasons; nobody but the server can write them.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261109000000_stubby_ask_drop_reasons.sql.

alter table public.stubby_asks
  add column drop_reasons jsonb
    check (drop_reasons is null or (jsonb_typeof(drop_reasons) = 'array' and jsonb_array_length(drop_reasons) <= 40));
