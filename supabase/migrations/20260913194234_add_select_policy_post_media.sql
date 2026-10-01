-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

create policy "post-media files are publicly readable"
on storage.objects
for select
using (bucket_id = 'post-media');
