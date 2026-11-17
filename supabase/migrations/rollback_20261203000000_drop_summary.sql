-- Rollback for 20261203000000_drop_summary.sql. The app falls back to reading
-- public.drops directly and shows no counts.
drop function if exists public.drop_summary(text);
delete from private.access_allowlist where name = 'drop_summary';
notify pgrst, 'reload schema';
