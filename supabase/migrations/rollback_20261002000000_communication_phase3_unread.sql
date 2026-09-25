-- Rollback for 20261002000000_communication_phase3_unread.sql.
--
--   Supabase → SQL Editor → New query → paste → Run

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_reads'
  ) then
    alter publication supabase_realtime drop table public.conversation_reads;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime drop table public.notifications;
  end if;
end $$;

drop function if exists public.thread_seen_at(bigint);
drop function if exists private.other_party_seen_at(bigint, uuid);

-- Back to the Phase 2 shape (no unread_count).
create or replace function public.participation_message_summaries()
returns table (
  participation_id bigint,
  message_count bigint,
  last_message_id bigint,
  last_message_from_user uuid,
  last_message_body text,
  last_message_created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as participation_id,
    coalesce(c.message_count, 0) as message_count,
    lm.id as last_message_id,
    lm.from_user as last_message_from_user,
    lm.body as last_message_body,
    lm.created_at as last_message_created_at
  from public.participations p
  left join lateral (
    select count(*) as message_count
    from public.messages m
    where m.participation_id = p.id
  ) c on true
  left join lateral (
    select m.id, m.from_user, m.body, m.created_at
    from public.messages m
    where m.participation_id = p.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where (p.from_user = auth.uid() or p.to_user = auth.uid())
    and not private.is_blocked_between(p.from_user, p.to_user);
$$;

revoke execute on function public.participation_message_summaries() from public, anon, authenticated;
grant execute on function public.participation_message_summaries() to authenticated;

alter table public.profile_settings drop column if exists read_receipts;

drop function if exists public.mark_conversation_read(bigint);

drop table if exists public.conversation_reads;
