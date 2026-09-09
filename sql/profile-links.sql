-- NoSpace: Profile links — GitHub, a design studio, a Substack, whatever
-- someone wants people to find from their profile.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- Links live in the app's local storage first (src/app/lib/profileLinks.ts)
-- so adding one works instantly, with or without an account. This table
-- exists only so a visitor, on a different device, can see the links a
-- signed-in owner added — the owner's own view always reads local storage
-- first. `id` is `text`, matching the local id already given to the link,
-- same reasoning as sql/pursuits.sql.
--
-- Unlike Pursuits, there's no privacy flag: a link someone adds here is
-- meant to be found, so every row is publicly readable.
create table if not exists public.profile_links (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profile_links enable row level security;

drop policy if exists "profile links are public" on public.profile_links;
create policy "profile links are public"
  on public.profile_links for select
  using (true);

drop policy if exists "you create your own links" on public.profile_links;
create policy "you create your own links"
  on public.profile_links for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you edit your own links" on public.profile_links;
create policy "you edit your own links"
  on public.profile_links for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "you delete your own links" on public.profile_links;
create policy "you delete your own links"
  on public.profile_links for delete
  using (auth.uid() = user_id);

create index if not exists profile_links_user_idx on public.profile_links (user_id, position);
