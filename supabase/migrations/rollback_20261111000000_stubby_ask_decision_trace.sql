-- Rollback for 20261111000000_stubby_ask_decision_trace.sql. The asks stay; only their decision traces go.

alter table public.stubby_asks drop column if exists decision_trace;
