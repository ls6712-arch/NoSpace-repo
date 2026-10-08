-- Verifies 20261020000000_profiles_terms_accepted_at.sql.
-- Run AFTER the migration. One transaction, rolls back whatever happens.
-- Reads the catalog only; it changes no rows.
begin;

do $$
declare
  results text[] := array[]::text[];
  v_type text;
  v_nullable text;
  v_default text;
  v_can_update boolean;
  v_can_select_anon boolean;
begin
  v_type := (select c.data_type from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'terms_accepted_at');
  results := results || ('column exists as timestamptz: ' || coalesce(v_type = 'timestamp with time zone', false)::text);

  v_nullable := (select c.is_nullable from information_schema.columns c
                  where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'terms_accepted_at');
  results := results || ('nullable: ' || coalesce(v_nullable = 'YES', false)::text);

  v_default := (select c.column_default from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'terms_accepted_at');
  results := results || ('no default: ' || (v_default is null)::text);

  v_can_update := has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE');
  results := results || ('authenticated can update it: ' || v_can_update::text);

  v_can_update := has_column_privilege('anon', 'public.profiles', 'terms_accepted_at', 'UPDATE');
  results := results || ('anon cannot update it: ' || (not v_can_update)::text);

  v_can_select_anon := has_column_privilege('anon', 'public.profiles', 'terms_accepted_at', 'SELECT');
  results := results || ('anon can read it (same as the rest of profiles, review if not wanted): ' || v_can_select_anon::text);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
