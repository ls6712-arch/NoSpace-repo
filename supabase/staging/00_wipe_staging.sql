-- Staging rebuild, step 1 of 4: empty the public and private schemas on nospace-staging.
-- See docs/staging-rebuild-runbook.md. NEVER run this on production.
--
-- It refuses to run if the database has any user, so it stops itself on production (11 users)
-- or on a staging that someone has started using. It touches only the public and private
-- schemas; Supabase's own schemas (auth, storage, extensions, realtime) are left alone.

\set ON_ERROR_STOP on

do $$
declare
  v_users bigint := (select count(*) from auth.users);
begin
  if v_users > 0 then
    raise exception 'Refusing to wipe: this database has % user(s). Staging should have none. Check you are connected to nospace-staging, not production.', v_users;
  end if;
  if to_regclass('public.posts') is not null and (select count(*) from public.posts) > 0 then
    raise exception 'Refusing to wipe: public.posts has rows. Check you are connected to nospace-staging.';
  end if;
end
$$;

begin;

drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

commit;
