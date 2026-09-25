-- Rollback for 20261001010000_communication_phase2_live.sql.
--
--   Supabase → SQL Editor → New query → paste → Run

drop function if exists public.participation_message_summaries();

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participations'
  ) then
    alter publication supabase_realtime drop table public.participations;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime drop table public.messages;
  end if;
end $$;
