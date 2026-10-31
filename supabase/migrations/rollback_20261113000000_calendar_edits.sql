-- Rollback for 20261113000000_calendar_edits.sql.
-- Drops the table and every free, busy and block entry in it. The calendar then shows only the usual
-- week (it treats a missing table as no entries), so blocks and one-off changes disappear.

drop table if exists public.calendar_entries;
