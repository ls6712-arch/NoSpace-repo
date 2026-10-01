-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

alter table public.posts add column if not exists pinned boolean not null default false;
create index if not exists posts_pinned_idx on public.posts (user_id, pinned);
