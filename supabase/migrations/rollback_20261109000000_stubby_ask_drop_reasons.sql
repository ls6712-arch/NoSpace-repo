-- Rollback for 20261109000000_stubby_ask_drop_reasons.sql. The asks stay; only their drop reasons go.

alter table public.stubby_asks drop column if exists drop_reasons;
