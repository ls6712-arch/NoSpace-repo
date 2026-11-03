-- Rollback for 20261111000100_stubby_guests.sql. Run before rollback_20261111000050_member_gate.sql.
-- Guests already made stay until removed by hand; their taste profiles and feedback go.

drop function if exists public.stubby_guest_ready();
select cron.unschedule('purge-inactive-guests');
drop function if exists private.purge_inactive_guests();

delete from private.access_allowlist where kind = 'table_nonmember' and name in ('stubby_profiles', 'stubby_feedback');

drop table if exists public.stubby_feedback;
drop function if exists private.fill_stubby_feedback();
drop function if exists private.flip_stubby_feedback();
drop table if exists public.stubby_profiles;
drop function if exists private.touch_stubby_profile();

drop function if exists public.claim_stubby_turn(uuid, boolean, text, integer, integer, integer, integer, integer);

create or replace function private.purge_stubby_rows()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.personal_picks p where coalesce(p.ends_at, p.starts_at) < now() - interval '2 days';
  delete from public.stubby_asks a where a.asked_at < now() - interval '30 days';
$$;

drop index if exists public.stubby_asks_ip_idx;
drop index if exists public.stubby_asks_guest_idx;
alter table public.stubby_asks drop column if exists ip_hash, drop column if exists guest;

drop table if exists private.stubby_settings;
