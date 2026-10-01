-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded. (public.reject_test_display_names(),
-- created here, is the function 20260925233120_harden_trigger_function_grants.sql
-- later pins a search_path on.)

create or replace function public.reject_test_display_names() returns trigger
language plpgsql
as $$
begin
  if new.display_name is not null and lower(trim(new.display_name)) = any (array[
    'test', 'testing', 'test account', 'test user', 'test profile',
    'qa', 'qa test', 'qa account', 'qa user',
    'alex tester', 'bailey qa',
    'dummy', 'dummy account', 'sample account', 'do not use', 'placeholder'
  ]) then
    raise exception 'That display name is reserved for testing and can''t be used.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_test_display_names on public.profiles;
create trigger reject_test_display_names
  before insert or update of display_name on public.profiles
  for each row execute function public.reject_test_display_names();
