-- Disable human onboarding/new writers first. Export new preferences before removing them.
drop function if exists public.save_personalization(uuid,bigint,jsonb);
delete from private.access_allowlist where kind='rpc_account' and name='save_personalization';
drop trigger if exists revise_stubby_capability on public.stubby_capabilities;
drop function if exists private.revise_stubby_capability();
alter table public.stubby_capabilities drop constraint if exists personalization_shape;
alter table public.stubby_capabilities drop column if exists personalization, drop column if exists revision;
drop function if exists private.valid_personalization(jsonb);
-- Keep review as a recognized resume marker so rollback never rewrites a user's progress.
