-- Rollback for 20261111000200_gate_service_role.sql. Warning: with the RPC gate on, this makes every
-- request with the service role key fail again ("permission denied for schema private"). Roll back
-- 20261111000010_member_rpc_gate.sql first (it removes the gate) if the gate is going too.

revoke usage on schema private from service_role;
