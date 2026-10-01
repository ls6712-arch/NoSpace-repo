-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

alter table public.profiles add column if not exists cover_title text;
alter table public.profiles add column if not exists cover_tagline text;
alter table public.profiles add column if not exists cover_post_id bigint references public.posts (id) on delete set null;
