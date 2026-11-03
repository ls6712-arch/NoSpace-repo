-- Private capability extension for Stubby V3 (#316): What Stubby knows (timezone, budget for an
-- activity, equipment, goals, preferences, memberships) and the learn-from-feedback opt-in. Original
-- onboarding stays in its existing tables and is used by default (Nov 3, 2026); only learning from
-- feedback needs consent.feedback. Applied on merge (the project is linked to main), approved by name
-- first. No explicit transaction: the integration runs each migration file in its own.
-- Verification: supabase/verification/stubby_capabilities_check.sql.
-- Rollback: rollback_20261112000000_stubby_capabilities.sql.
create table if not exists public.stubby_capabilities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null check (coalesce((
    jsonb_typeof(profile) = 'object'
    and profile->>'version' = '1'
    and jsonb_typeof(profile->'consent') = 'object'
    and jsonb_typeof(profile->'consent'->'memory') = 'boolean'
    and jsonb_typeof(profile->'consent'->'onboarding') = 'boolean'
    and jsonb_typeof(profile->'consent'->'feedback') = 'boolean'
    and octet_length(profile::text) <= 20000
  ), false)),
  updated_at timestamptz not null default now()
);
alter table public.stubby_capabilities enable row level security;
revoke all on public.stubby_capabilities from public, anon, authenticated;
grant select, insert, update, delete on public.stubby_capabilities to authenticated;
drop policy if exists "owner capability access" on public.stubby_capabilities;
create policy "owner capability access" on public.stubby_capabilities for all to authenticated
  using (stubby_capabilities.user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'true') = 'false')
  with check (stubby_capabilities.user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'true') = 'false');
drop policy if exists "capability isolation" on public.stubby_capabilities;
create policy "capability isolation" on public.stubby_capabilities as restrictive for all to authenticated
  using (stubby_capabilities.user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'true') = 'false')
  with check (stubby_capabilities.user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'true') = 'false');

-- Caller-scoped transaction. Revocation and deletion cannot partially succeed.
create or replace function public.forget_stubby_memory(expected_user uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if expected_user is distinct from (select auth.uid()) or (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous'), 'true') <> 'false' then
    raise exception 'Account required' using errcode = '42501';
  end if;
  delete from public.stubby_feedback where stubby_feedback.user_id = (select auth.uid());
  delete from public.stubby_capabilities where stubby_capabilities.user_id = (select auth.uid());
end $$;
revoke all on function public.forget_stubby_memory(uuid) from public, anon;
grant execute on function public.forget_stubby_memory(uuid) to authenticated;
insert into private.access_allowlist (kind, name, reason) values
  ('table_nonmember', 'stubby_capabilities', 'Owner-only memory for non-anonymous accounts; no guest access'),
  ('rpc_account', 'forget_stubby_memory', 'Caller-scoped deletion of private memory and feedback')
on conflict (kind, name) do update set reason = excluded.reason;
