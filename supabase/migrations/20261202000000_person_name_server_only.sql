-- Soosh: pursuit_person_name() is for the database's own use, not something anyone can call.
--
-- Rollback: rollback_20261202000000_person_name_server_only.sql.
-- Verification: supabase/verification/person_name_server_only_check.sql.
--
-- public.pursuit_person_name(uuid) returns a person's display name for any account id, with no
-- check of who is asking: it answered signed-out callers too, and for paused or deleting accounts
-- that are hidden everywhere else (launch audit, Nov 11, 2026). The app never calls it. It is only
-- used inside other database functions, all of them SECURITY DEFINER (the notification triggers,
-- get_profile_stubs, admin_first_moments_waiting), which run as their owner and keep working.
--
-- So: nobody outside the database may run it any more. The function itself is unchanged. Its two
-- entries leave the non-member allowlist (private.access_allowlist and
-- supabase/security/access-allowlist.json), where 20261111000010_member_rpc_gate.sql listed it for
-- the Pursuit invite page; that page gets the name from pursuit_invite_preview() and never called this.

revoke execute on function public.pursuit_person_name(uuid) from public, anon, authenticated;

delete from private.access_allowlist where kind = 'rpc_anon' and name in ('pursuit_person_name');
delete from private.access_allowlist where kind = 'rpc_guest' and name in ('pursuit_person_name');
