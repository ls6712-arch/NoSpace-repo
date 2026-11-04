drop trigger if exists stubby_feedback_positive on public.stubby_feedback;
drop function if exists private.scope_positive_feedback();
-- Turn off new writers first. Export reason/scope before removing these columns.
delete from private.access_allowlist where kind='rpc_guest' and name='record_stubby_feedback';
drop function if exists public.record_stubby_feedback(bigint,text,text,text);
alter table public.stubby_feedback drop constraint if exists feedback_scope_valid,drop constraint if exists feedback_reason_valid;
alter table public.stubby_feedback drop column if exists reason,drop column if exists scope;
