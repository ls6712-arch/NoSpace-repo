-- NoSpace: participation, thoughts, notifications and messages.
--
-- Everything here is inherently between two people, which is why none of it
-- can live in the browser: the recipient of a request is on another device.
-- Run this whole file once in the Supabase SQL Editor.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run: every statement is guarded.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Profile pictures
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Activity posts — a date, a place, and how precisely to show the place
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists starts_at timestamptz;
alter table public.posts add column if not exists location_name text;
alter table public.posts
  add column if not exists location_privacy text
  default 'neighborhood'
  check (location_privacy in ('exact','neighborhood','city','approximate','hidden'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Following a hobby, never a person
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.hobby_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A sub-hobby slug ("film-photography") or "space:<slug>" for a whole Space.
  hobby_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, hobby_key)
);
alter table public.hobby_follows enable row level security;

drop policy if exists "hobby follows are readable" on public.hobby_follows;
create policy "hobby follows are readable"
  on public.hobby_follows for select using (true);

drop policy if exists "you manage your own hobby follows" on public.hobby_follows;
create policy "you manage your own hobby follows"
  on public.hobby_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Participation — the four ways to be part of something
--
--    keep_exploring  follows a hobby (no person relationship, no request)
--    join_in         taking part in an activity someone posted
--    make_together   mutual, must be accepted
--    explore_together mutual, must be accepted
--
-- Only an accepted make_together / explore_together unlocks messaging.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.participations (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('join_in','make_together','explore_together')),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete cascade,
  -- What it's about: the post being joined, and/or the hobby it concerns.
  post_id bigint references public.posts (id) on delete cascade,
  hobby_key text,
  -- The specific thing proposed, e.g. "Ask about their setup".
  intent text,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.participations enable row level security;

drop policy if exists "you see participations you are part of" on public.participations;
create policy "you see participations you are part of"
  on public.participations for select
  using (auth.uid() = from_user or auth.uid() = to_user or to_user is null);

drop policy if exists "you can ask" on public.participations;
create policy "you can ask"
  on public.participations for insert to authenticated
  with check (auth.uid() = from_user);

-- The recipient answers; the sender may withdraw.
drop policy if exists "the recipient answers" on public.participations;
create policy "the recipient answers"
  on public.participations for update
  using (auth.uid() = to_user or auth.uid() = from_user)
  with check (auth.uid() = to_user or auth.uid() = from_user);

drop policy if exists "you can withdraw" on public.participations;
create policy "you can withdraw"
  on public.participations for delete using (auth.uid() = from_user);

create index if not exists participations_to_user_idx on public.participations (to_user, status);
create index if not exists participations_post_idx on public.participations (post_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Thoughts — prompted reflections on a moment, not a comment thread
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.thoughts (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.thoughts enable row level security;

-- Public by default. When the poster switches a moment to private thoughts,
-- only they and the person who wrote it can read it.
alter table public.posts add column if not exists thoughts_private boolean not null default false;

drop policy if exists "thoughts follow the moment's setting" on public.thoughts;
create policy "thoughts follow the moment's setting"
  on public.thoughts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.posts p
      where p.id = thoughts.post_id
        and (p.thoughts_private = false or p.user_id = auth.uid())
    )
  );

drop policy if exists "anyone signed in can add a thought" on public.thoughts;
create policy "anyone signed in can add a thought"
  on public.thoughts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "you can remove your own thought" on public.thoughts;
create policy "you can remove your own thought"
  on public.thoughts for delete using (auth.uid() = user_id);

create index if not exists thoughts_post_idx on public.thoughts (post_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Notifications — written by the app, read only by their owner
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  body text not null,
  href text,
  actor_name text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "you read your own notifications" on public.notifications;
create policy "you read your own notifications"
  on public.notifications for select using (auth.uid() = user_id);

-- Anyone signed in may notify someone else — that is what a request or a
-- thought is. Bodies are written by the app, not by the sender.
drop policy if exists "signed-in users can notify" on public.notifications;
create policy "signed-in users can notify"
  on public.notifications for insert to authenticated with check (true);

drop policy if exists "you mark your own as read" on public.notifications;
create policy "you mark your own as read"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Messages — only within an accepted make_together / explore_together
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  participation_id bigint not null references public.participations (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

drop policy if exists "messages need an accepted participation" on public.messages;
create policy "messages need an accepted participation"
  on public.messages for select
  using (
    exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together','explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

drop policy if exists "you can write in an accepted thread" on public.messages;
create policy "you can write in an accepted thread"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together','explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

create index if not exists messages_participation_idx
  on public.messages (participation_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Editing your own moments (needed by the moment detail's Edit action)
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "own posts are editable" on public.posts;
create policy "own posts are editable"
  on public.posts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
