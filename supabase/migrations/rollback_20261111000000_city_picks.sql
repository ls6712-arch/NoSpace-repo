-- Rollback for 20261111000000_city_picks.sql.
-- Drops the table and every pick in it. The Week view then hides its "This week in New York"
-- row (it treats a missing table as no picks).

drop table if exists public.city_picks;
