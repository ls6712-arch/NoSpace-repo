-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded. (public.rl_post_likes() and
-- public.sync_post_likes_count(), created here, are the two functions
-- 20260925233120_harden_trigger_function_grants.sql later locks down.)

-- NoSpace: real, cross-device likes.
--
-- Before this, a like (ContentContext's toggleLike) was purely local — a
-- `likeDeltas` map layered on top of posts.likes in this browser tab only,
-- gone on reload and never shared between devices for the same account.
-- This table makes "did I like this" a real per-account fact, and a
-- trigger keeps posts.likes itself in sync so every existing read of that
-- column (rowToPost in ContentContext.tsx, feed ranking's engagementScore)
-- needs no changes at all.

create table if not exists public.post_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_likes enable row level security;

create index if not exists post_likes_post_idx on public.post_likes (post_id);

drop policy if exists "post likes are readable" on public.post_likes;
create policy "post likes are readable"
  on public.post_likes for select using (auth.uid() is not null);

drop policy if exists "you manage your own likes" on public.post_likes;
create policy "you manage your own likes"
  on public.post_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
