-- Pause/deletion follow-up, migration (d): a real, cross-device reactions
-- table. Draft only.
--
-- Reactions (Love this / I'm in / Keep going) are currently local-only —
-- in-memory/localStorage in PostReactions.tsx — never written to Supabase.
-- That already matches the product rule "no counts shown to others" by
-- accident, but it also means a reaction doesn't survive a different
-- device or browser, and a post's author has no way to know who reacted.
-- This table fixes the persistence without adding any counting: no
-- aggregate column, no count view, nothing exposed beyond "did I react"
-- and, for the post's author only, "who reacted."
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('love_this', 'im_in', 'keep_going')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, type)
);

alter table public.reactions enable row level security;

create policy "you react as yourself"
  on public.reactions for insert
  with check (auth.uid() = user_id);

create policy "you remove your own reaction"
  on public.reactions for delete
  using (auth.uid() = user_id);

-- Visible to the person who left it and to the post's author only — never
-- to a third party, and never as a count.
create policy "the reactor and the post's author can see a reaction"
  on public.reactions for select
  using (
    auth.uid() = user_id
    or auth.uid() = (select p.user_id from public.posts p where p.id = reactions.post_id)
  );

-- No bookmarks table exists yet either — "Try This" (toggleSaved/isSaved in
-- lib/journal.ts) is also localStorage-only today. Proposed shape below,
-- NOT created by this migration — left commented out pending a decision on
-- whether it moves server-side in this same pass or stays local for now:
--
-- create table if not exists public.bookmarks (
--   id bigint generated always as identity primary key,
--   user_id uuid not null references auth.users(id) on delete cascade,
--   post_id bigint not null references public.posts(id) on delete cascade,
--   created_at timestamptz not null default now(),
--   unique (user_id, post_id)
-- );
-- alter table public.bookmarks enable row level security;
-- create policy "you manage your own bookmarks"
--   on public.bookmarks for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
