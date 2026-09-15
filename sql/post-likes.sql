-- NoSpace: real, cross-device likes.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Before this, a like (ContentContext's toggleLike) was
-- purely local — a `likeDeltas` map layered on top of `posts.likes` in this
-- browser tab only, gone on reload and never shared between devices for the
-- same account. This table makes "did I like this" a real per-account fact,
-- and a trigger keeps posts.likes itself in sync so every existing read of
-- that column (rowToPost in ContentContext.tsx, feed ranking's
-- engagementScore) needs no changes at all.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_likes enable row level security;

create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS — same shape as hobby_follows (sql/social.sql): readable by anyone
--    signed in (the app gates everything past the landing page on having an
--    account, so a signed-out read has nothing left to serve it anyway —
--    signed-out visitors still see like *counts* fine, via posts.likes,
--    which has its own public select policy), writable only for your own row.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "post likes are readable" on public.post_likes;
create policy "post likes are readable"
  on public.post_likes for select using (auth.uid() is not null);

drop policy if exists "you manage your own likes" on public.post_likes;
create policy "you manage your own likes"
  on public.post_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. posts.likes as a derived count — a trigger instead of a
--    select-count(*)-join on every feed query, since this table is read far
--    more often than liked. +1/-1 per row rather than a full recount: the
--    primary key already rules out double-counting the same (user, post).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.sync_post_likes_count() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes = likes + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set likes = greatest(0, likes - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_sync_count on public.post_likes;
create trigger post_likes_sync_count
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_likes_count();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Rate limiting, same shape as every other insert-heavy table
--    (security-hardening.sql, circles.sql) — generous, since scrolling a
--    feed and liking several posts in a row is completely normal use.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.rl_post_likes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('post_likes_insert', 100, interval '10 minutes');
  return new;
end;
$$;
drop trigger if exists rl_post_likes_insert on public.post_likes;
create trigger rl_post_likes_insert before insert on public.post_likes
  for each row execute function public.rl_post_likes();
