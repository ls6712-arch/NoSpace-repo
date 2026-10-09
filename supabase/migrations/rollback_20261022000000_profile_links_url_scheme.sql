-- Rollback for 20261022000000_profile_links_url_scheme.sql.
alter table public.profile_links drop constraint if exists profile_links_url_http_check;
