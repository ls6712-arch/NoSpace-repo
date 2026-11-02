-- Rollback for 20261111000000_member_rpc_gate.sql. Run rollback_20261111000050 (and 000100) first
-- if the guest Stubby migrations are applied.
-- Members-only RPCs and the onboarding rule go back to how they were on Nov 2, 2026. Trigger
-- functions keep EXECUTE revoked: they never needed it.

alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';

drop function if exists public.finish_onboarding();
grant update (onboarding_completed, onboarding_completed_at) on public.profiles to authenticated;

drop function if exists private.request_gate();
drop table if exists private.access_allowlist;
drop function if exists private.is_member();
drop function if exists private.is_anonymous();
