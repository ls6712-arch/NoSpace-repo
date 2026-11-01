-- Calendar, PR 4: calendar_feed_tokens, the key to a person's private subscribe link.
--
-- Run AFTER 20261113000000_calendar_edits.sql. Applied only with the founder's written approval
-- naming this file (CLAUDE.md). The edge function that serves the feed
-- (supabase/functions/calendar-feed) is deployed separately and needs this table.
--
-- The link is https://<project>.supabase.co/functions/v1/calendar-feed?token=<token>. The token is made
-- in the person's browser (32 random bytes) and never sent here: only its SHA-256 (64 hex characters)
-- is stored, so nobody with database access can rebuild a link. Resetting the link revokes the old
-- hash and stores a new one, in one step; a person has at most one active link (a unique index).
--
-- Only the person can see that they have a link, and when it was made. They cannot read the hash
-- (column grants), and they cannot write the table directly: set_calendar_feed_token() is the only way
-- in. The edge function reads it with the service role.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261114000000_calendar_feed.sql.

create table public.calendar_feed_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- One active link a person, and one hash one row.
create unique index calendar_feed_tokens_one_active_idx on public.calendar_feed_tokens (user_id) where revoked_at is null;
create unique index calendar_feed_tokens_hash_key on public.calendar_feed_tokens (token_hash);

alter table public.calendar_feed_tokens enable row level security;

revoke all on public.calendar_feed_tokens from public, anon, authenticated;
-- Not token_hash: it is never read back by the app.
grant select (id, user_id, created_at, revoked_at) on public.calendar_feed_tokens to authenticated;

create policy "you see your own links"
  on public.calendar_feed_tokens for select to authenticated
  using (calendar_feed_tokens.user_id = (select auth.uid()));

-- Makes (or resets) the person's link: revokes any active one and stores the new hash.
create function public.set_calendar_feed_token(p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_at timestamptz := now();
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'not a token hash' using errcode = '22023';
  end if;
  update public.calendar_feed_tokens t set revoked_at = v_at where t.user_id = v_me and t.revoked_at is null;
  insert into public.calendar_feed_tokens (user_id, token_hash, created_at) values (v_me, p_token_hash, v_at);
  return v_at;
end;
$$;

revoke all on function public.set_calendar_feed_token(text) from public, anon;
grant execute on function public.set_calendar_feed_token(text) to authenticated;
