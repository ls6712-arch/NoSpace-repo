-- Sushii: Communication Phase 3 (Unread, Seen, and a quieter bell) —
-- conversation_reads, unread counts on the existing thread summary, a
-- narrowly-scoped "Seen" function, read-receipts opt-out, and Realtime on
-- notifications/conversation_reads.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- STAGED — NOT YET APPLIED. Shown for review before running, per Sush's
-- request. See docs/communication-strategy.md's Phase 3 section.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. conversation_reads: per person, per conversation, last read time
-- ═══════════════════════════════════════════════════════════════════════
--
-- Owner-only in every direction — nobody, including the other party in the
-- conversation, can read your row directly. The only sanctioned way anyone
-- learns your read time is thread_seen_at() below, which is deliberately
-- narrow (accepted threads only, respects both parties' read_receipts,
-- never for a blocked pair). No delete policy: there's nothing to delete —
-- a "read" time only ever moves forward (see mark_conversation_read's
-- greatest()), so removing a row would just make it look unread again.
create table public.conversation_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  participation_id bigint not null references public.participations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, participation_id)
);

alter table public.conversation_reads enable row level security;

-- Shared by all three policies below: your own row, for a participation
-- you're actually a party to, that isn't blocked-between. Being blocked
-- doesn't remove you as from_user/to_user (so "party to" alone isn't
-- enough) — the same "block hides the relationship entirely" rule as
-- everywhere else in this app.
create policy "you see your own conversation_reads"
  on public.conversation_reads
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.participations p
      where p.id = conversation_reads.participation_id
        and (p.from_user = auth.uid() or p.to_user = auth.uid())
        and not private.is_blocked_between(p.from_user, p.to_user)
    )
  );

create policy "you insert your own conversation_reads"
  on public.conversation_reads
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.participations p
      where p.id = conversation_reads.participation_id
        and (p.from_user = auth.uid() or p.to_user = auth.uid())
        and not private.is_blocked_between(p.from_user, p.to_user)
    )
  );

create policy "you update your own conversation_reads"
  on public.conversation_reads
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.participations p
      where p.id = conversation_reads.participation_id
        and (p.from_user = auth.uid() or p.to_user = auth.uid())
        and not private.is_blocked_between(p.from_user, p.to_user)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. mark_conversation_read(pid): the only way a read time is ever written
-- ═══════════════════════════════════════════════════════════════════════
--
-- security invoker: the participations lookup runs under the CALLER's own
-- RLS, so a pid they're not allowed to see resolves to no row at all —
-- "not a party" and "doesn't exist" look identical, which is the point
-- (never confirm a participation id exists to someone who isn't in it).
-- Accepted-only: reading a pending request's preview must never produce
-- Seen for its sender — the recipient of a pending direct_message has no
-- accepted thread yet to mark read at all.
create or replace function public.mark_conversation_read(pid bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_is_party boolean;
begin
  select status, (from_user = auth.uid() or to_user = auth.uid())
    into v_status, v_is_party
    from public.participations
    where id = pid;

  if v_is_party is not true then
    raise exception 'not a party to this conversation';
  end if;
  if v_status is distinct from 'accepted' then
    raise exception 'conversation is not accepted';
  end if;

  insert into public.conversation_reads (user_id, participation_id, last_read_at)
  values (auth.uid(), pid, now())
  on conflict (user_id, participation_id)
  do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
end;
$$;

revoke execute on function public.mark_conversation_read(bigint) from public, anon;
grant execute on function public.mark_conversation_read(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. profile_settings.read_receipts — on by default, off works both ways
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profile_settings
  add column if not exists read_receipts boolean not null default true;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. participation_message_summaries(): add unread_count
-- ═══════════════════════════════════════════════════════════════════════
--
-- unread_count = messages from the OTHER person, newer than my own
-- last_read_at (everything, if I've never opened this thread — the
-- coalesce to -infinity). Computed for every thread the caller is a party
-- to, pending/declined direct_message requests included: the database
-- doesn't need to know "pending requests count toward Message requests,
-- not Chats" — that's the app deciding which bucket a thread's number
-- belongs in, same as it already decides which tab a thread appears in.
create or replace function public.participation_message_summaries()
returns table (
  participation_id bigint,
  message_count bigint,
  last_message_id bigint,
  last_message_from_user uuid,
  last_message_body text,
  last_message_created_at timestamptz,
  unread_count bigint
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
    lm.created_at as last_message_created_at,
    coalesce(u.unread_count, 0) as unread_count
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
  left join lateral (
    select count(*) as unread_count
    from public.messages m
    where m.participation_id = p.id
      and m.from_user <> auth.uid()
      and m.created_at > coalesce(
        (
          select cr.last_read_at from public.conversation_reads cr
          where cr.user_id = auth.uid() and cr.participation_id = p.id
        ),
        '-infinity'::timestamptz
      )
  ) u on true
  where (p.from_user = auth.uid() or p.to_user = auth.uid())
    and not private.is_blocked_between(p.from_user, p.to_user);
$$;

revoke execute on function public.participation_message_summaries() from public, anon, authenticated;
grant execute on function public.participation_message_summaries() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Seen: private DEFINER helper + narrow public wrapper
-- ═══════════════════════════════════════════════════════════════════════
--
-- private.other_party_seen_at is the ONLY place in this migration that
-- reads another user's conversation_reads or profile_settings row —
-- SECURITY DEFINER, bypassing both tables' owner-only RLS on purpose, and
-- locked down to no direct execute (not even authenticated) so it's only
-- reachable through thread_seen_at's own checks below.
create or replace function private.other_party_seen_at(pid bigint, other_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select cr.last_read_at
  from public.conversation_reads cr
  where cr.user_id = other_user
    and cr.participation_id = pid
    -- A missing profile_settings row means defaults — read_receipts on —
    -- same rule as everywhere else this table is read.
    and coalesce(
      (select ps.read_receipts from public.profile_settings ps where ps.user_id = other_user),
      true
    ) = true
$$;

revoke execute on function private.other_party_seen_at(bigint, uuid) from public, anon, authenticated;

-- security invoker: everything it looks at directly (the participation row,
-- its own read_receipts) is already visible to the caller under existing
-- RLS; only the other party's data is delegated to the DEFINER helper
-- above. Returns null — never an error — for a non-party, a non-accepted
-- thread, a blocked pair, or either side having receipts off, so a caller
-- can't distinguish "never read" from "not allowed to know".
create or replace function public.thread_seen_at(pid bigint)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from uuid;
  v_to uuid;
  v_status text;
  v_other uuid;
  v_my_receipts boolean;
begin
  select from_user, to_user, status
    into v_from, v_to, v_status
    from public.participations
    where id = pid
      and (from_user = auth.uid() or to_user = auth.uid());

  if v_from is null then
    return null;
  end if;
  if v_status is distinct from 'accepted' then
    return null;
  end if;
  if private.is_blocked_between(v_from, v_to) then
    return null;
  end if;

  v_other := case when v_from = auth.uid() then v_to else v_from end;
  if v_other is null then
    return null;
  end if;

  select read_receipts into v_my_receipts
    from public.profile_settings
    where user_id = auth.uid();
  if coalesce(v_my_receipts, true) is false then
    return null;
  end if;

  return private.other_party_seen_at(pid, v_other);
end;
$$;

revoke execute on function public.thread_seen_at(bigint) from public, anon;
grant execute on function public.thread_seen_at(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Realtime: publish notifications and conversation_reads
-- ═══════════════════════════════════════════════════════════════════════
--
-- Both tables' existing RLS already limits each subscriber to their own
-- rows, so this only ever delivers a person their own bell updates and
-- their own read state syncing across their own devices — never someone
-- else's.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_reads'
  ) then
    alter publication supabase_realtime add table public.conversation_reads;
  end if;
end $$;
