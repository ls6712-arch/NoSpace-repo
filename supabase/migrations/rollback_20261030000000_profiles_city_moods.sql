-- Rollback for 20261030000000_profiles_city_moods.sql.
-- Drops both columns (their constraints and column grants go with them). Any
-- city or moods a person saved is lost.

alter table public.profiles
  drop column if exists city,
  drop column if exists moods;
