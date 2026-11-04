-- Disable STUBBY_ASK_ENGINE=v3 first. This removes only the V3 extension.
begin;
drop function if exists public.forget_stubby_memory(uuid);
drop table if exists public.stubby_capabilities;
delete from private.access_allowlist where kind = 'table_nonmember' and name = 'stubby_capabilities';
delete from private.access_allowlist where kind = 'rpc_account' and name = 'forget_stubby_memory';
commit;
