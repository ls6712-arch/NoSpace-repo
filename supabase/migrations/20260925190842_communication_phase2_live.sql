-- Sushii: Communication Phase 2 (Live and reliable) — Realtime on
-- messages/participations, and a per-thread summary for the conversation
-- list without loading every message history.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- STAGED — NOT YET APPLIED. Shown for review before running, per Sush's
-- request.
--
-- See docs/communication-strategy.md's Phase 2 section for the plan this
-- implements. No schema changes to messages/participations themselves —
-- just turning on Realtime for two tables already governed by RLS, and one
-- new read-only function.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Realtime: publish messages and participations
-- ═══════════════════════════════════════════════════════════════════════
--
-- Supabase Realtime's Postgres Changes feature only streams changes for
-- tables in the `supabase_realtime` publication, and (per Supabase's own
-- docs, confirmed against supabase-js ^2.116's behavior) enforces the
-- subscribing user's own RLS on the changed row before delivering it — so
-- turning this on doesn't widen who can see what; the existing SELECT
-- policies on both tables are still the only thing deciding that. Wrapped
-- in existence checks so this is safe to re-run (the publication is
-- confirmed to have zero tables in it today, but a partial retry
-- shouldn't error on the second pass).
--
-- Both tables are needed: messages so a new message streams straight in,
-- participations so a new message request landing, an Accept, an Ignore,
-- or a block making a thread disappear all reach the other person live
-- too — none of those are message rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participations'
  ) then
    alter publication supabase_realtime add table public.participations;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. participation_message_summaries(): one row per thread, no history
-- ═══════════════════════════════════════════════════════════════════════
--
-- Feeds the conversation list preview, the Message requests preview, and
-- the composer's one-message-while-pending rule (hasMessages), all without
-- fetching every message of every thread on every load — that full-history
-- fetch is exactly what Phase 1's SocialContext.tsx refresh() does today.
--
-- `security invoker` (the default, made explicit) means this function's
-- own queries run under the CALLING user's row-level security, not the
-- function owner's — the same messages/participations RLS policies that
-- already govern direct reads apply here unchanged. Two things follow
-- directly from that, both proven in the verification script:
--   - A blocked pair's messages are already invisible to each other via
--     messages' own RLS (`not private.is_blocked_between(...)`); this
--     function also excludes the participation ROW itself for a blocked
--     pair, so no ghost thread with a zero count ever appears — the
--     database is the one deciding that, not the app.
--   - The messages SELECT policy lets a declined direct_message's
--     RECIPIENT see nothing (only its sender can still read, per
--     `(status = 'declined' AND auth.uid() = from_user)`), so the
--     recipient's own call to this function gets message_count = 0 and
--     null last-message fields for that thread — no preview leaks through
--     a summary that wasn't available through the underlying table either.
--
-- `set search_path` closes the usual search_path-hijacking hole even
-- though every reference here is already schema-qualified. No anon
-- execute: this is only useful to someone with real participations to
-- summarize.
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
