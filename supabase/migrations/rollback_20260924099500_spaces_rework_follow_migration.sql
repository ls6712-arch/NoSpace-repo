-- Rollback for 20260924099500_spaces_rework_follow_migration.sql.
--
-- Draft only — staged for review, not run.
--
-- Only usable if that migration's archive step ran and
-- archive.hobby_follows_bare_slug_20260924 still exists. Restores the
-- bare-slug spelling for rows this migration actually converted; rows it
-- left alone (ambiguous or no-match) were never touched, so there's
-- nothing to restore for those.

with archived as (
  select user_id, hobby_key as bare_key from archive.hobby_follows_bare_slug_20260924
)
update public.hobby_follows hf
set hobby_key = a.bare_key
from archived a
where hf.user_id = a.user_id
  and hf.hobby_key like '%:' || a.bare_key
  and hf.hobby_key <> a.bare_key
  and not exists (
    select 1 from public.hobby_follows x where x.user_id = a.user_id and x.hobby_key = a.bare_key
  );
