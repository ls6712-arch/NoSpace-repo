-- Rollback for 20261030000000_profiles_city_moods.sql.
-- Drops the private table (with every saved city) and the moods column (its
-- constraint and column grant go with it). Anything saved in either is lost.

drop table if exists public.profile_private;

alter table public.profiles
  drop column if exists moods;
