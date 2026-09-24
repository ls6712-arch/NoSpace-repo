-- Reverses supabase/migrations/20260919230300_reactions.sql. Purely
-- additive forward migration, so this is a straightforward drop — but it
-- is destructive of any real reaction/bookmark rows written since it was
-- applied. Confirm that's acceptable before running.
drop table if exists public.reactions;
drop table if exists public.bookmarks;
