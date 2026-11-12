-- Rollback for 20261202000000_person_name_server_only.sql: anyone may call pursuit_person_name() again,
-- signed in or not, as before, and it is back on the non-member allowlist (add it back to
-- supabase/security/access-allowlist.json too, under rpc_anon and rpc_guest).
grant execute on function public.pursuit_person_name(uuid) to anon, authenticated;
insert into private.access_allowlist (kind, name, reason) values
  ('rpc_anon', 'pursuit_person_name', 'Pursuit invite page before sign-up'),
  ('rpc_guest', 'pursuit_person_name', 'Pursuit invite page')
on conflict do nothing;
