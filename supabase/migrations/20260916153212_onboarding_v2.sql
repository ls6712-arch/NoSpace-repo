-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
update public.profiles set onboarding_completed = true where onboarding_completed = false;
