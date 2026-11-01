-- Rollback for 20261117000000_stubby_scout.sql.
-- Drops the run log and the scout columns. Scout picks stay as ordinary City picks (drafts
-- stay drafts); they only lose their source link, checked time and note.

drop table if exists public.scout_runs;

drop index if exists public.city_picks_scout_once_idx;

alter table public.city_picks
  drop constraint if exists city_picks_scout_has_source,
  drop column if exists scout_note,
  drop column if exists checked_at,
  drop column if exists source_url,
  drop column if exists found_by;
