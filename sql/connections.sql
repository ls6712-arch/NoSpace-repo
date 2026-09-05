-- NoSpace: connections, user-made Spaces, and invitations.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run after social.sql, people.sql and fixes.sql.
--
-- The rule this file exists to enforce, in the database rather than only in
-- the app: no private interaction between two people until both have agreed.
-- A profile is public as a portfolio and private as a place to be reached.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Free-text hobby on a post
--
--    The eight Spaces stay the destination. What a post is *about* is now
--    its own thing, typed by the person and shared across Spaces: "Pottery",
--    "Bouldering", "Sourdough".
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists interest text;

-- Suggestions come from what people have already written, so wording
-- converges without anyone maintaining a list.
create index if not exists posts_interest_idx on public.posts (lower(interest));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Connections — mutual, and the only thing that opens messaging
--
--    One row per pair. `least/greatest` on the two ids keeps it that way no
--    matter who asks first, so A→B and B→A can't both exist.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.connections (
  id bigint generated always as identity primary key,
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  -- The optional short note that came with the request.
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  -- You can't connect with yourself.
  constraint connections_two_people check (requester <> addressee),
  -- One connection per pair, whichever direction it was asked in.
  constraint connections_one_per_pair
    unique (requester, addressee)
);

create unique index if not exists connections_pair_unordered
  on public.connections (least(requester, addressee), greatest(requester, addressee));

alter table public.connections enable row level security;

drop policy if exists "you see your own connections" on public.connections;
create policy "you see your own connections"
  on public.connections for select
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "you can ask to connect" on public.connections;
create policy "you can ask to connect"
  on public.connections for insert to authenticated
  with check (auth.uid() = requester and requester <> addressee);

-- Only the person who was asked can accept or decline. The requester
-- withdrawing is a delete, below — not an update.
drop policy if exists "only the addressee answers" on public.connections;
create policy "only the addressee answers"
  on public.connections for update
  using (auth.uid() = addressee) with check (auth.uid() = addressee);

drop policy if exists "either side can withdraw or disconnect" on public.connections;
create policy "either side can withdraw or disconnect"
  on public.connections for delete
  using (auth.uid() = requester or auth.uid() = addressee);

create index if not exists connections_addressee_idx
  on public.connections (addressee, status);

/** True when these two people have an accepted connection, in either direction. */
create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester = a and c.addressee = b) or (c.requester = b and c.addressee = a))
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Spaces people make, and invitations into them
--
--    Distinct from the eight hobby Spaces, which are the app's browsable
--    destinations. These are groups someone creates around an interest and
--    invites people into.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.spaces (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  /** The hobby Space it sits under, and what it's about. */
  hobby_slug text,
  interest text,
  visibility text not null default 'invite' check (visibility in ('invite', 'open')),
  created_at timestamptz not null default now()
);
alter table public.spaces enable row level security;

create table if not exists public.space_members (
  space_id bigint not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  /** 'invited' until they accept; 'joined' after. */
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_members enable row level security;

/** True when this person has actually joined that Space. */
create or replace function public.is_space_member(s bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = s and m.user_id = u and m.status = 'joined'
  );
$$;

drop policy if exists "spaces are visible to members and by invitation" on public.spaces;
create policy "spaces are visible to members and by invitation"
  on public.spaces for select
  using (
    visibility = 'open'
    or owner = auth.uid()
    or exists (
      select 1 from public.space_members m
      where m.space_id = spaces.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "you can make a space" on public.spaces;
create policy "you can make a space"
  on public.spaces for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "the owner edits the space" on public.spaces;
create policy "the owner edits the space"
  on public.spaces for update using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "the owner removes the space" on public.spaces;
create policy "the owner removes the space"
  on public.spaces for delete using (auth.uid() = owner);

drop policy if exists "you see membership of spaces you are in" on public.space_members;
create policy "you see membership of spaces you are in"
  on public.space_members for select
  using (
    user_id = auth.uid()
    or public.is_space_member(space_id, auth.uid())
    or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
  );

-- You may invite someone into a Space you're actually in.
drop policy if exists "members invite" on public.space_members;
create policy "members invite"
  on public.space_members for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
    )
  );

-- You answer your own invitation. Nobody accepts on your behalf.
drop policy if exists "you answer your own invitation" on public.space_members;
create policy "you answer your own invitation"
  on public.space_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "you can leave, the owner can remove" on public.space_members;
create policy "you can leave, the owner can remove"
  on public.space_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Messaging requires a connection, or a shared Space
--
--    This replaces the old rule, which hung messaging off an accepted
--    make_together / explore_together request. Same principle, one concept:
--    you can write to someone you're connected to, or to a Space you're in.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists to_user uuid references auth.users (id) on delete cascade;
alter table public.messages add column if not exists space_id bigint references public.spaces (id) on delete cascade;
alter table public.messages alter column participation_id drop not null;

drop policy if exists "messages need an accepted participation" on public.messages;
drop policy if exists "you can write in an accepted thread" on public.messages;

drop policy if exists "you read messages meant for you" on public.messages;
create policy "you read messages meant for you"
  on public.messages for select
  using (
    -- A one-to-one message, only between connected people.
    (
      to_user is not null
      and (auth.uid() = from_user or auth.uid() = to_user)
      and public.are_connected(from_user, to_user)
    )
    -- Or a message in a Space you've joined.
    or (space_id is not null and public.is_space_member(space_id, auth.uid()))
  );

drop policy if exists "you write to connections and your spaces" on public.messages;
create policy "you write to connections and your spaces"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and (
      (to_user is not null and public.are_connected(auth.uid(), to_user))
      or (space_id is not null and public.is_space_member(space_id, auth.uid()))
    )
  );

create index if not exists messages_pair_idx on public.messages (to_user, from_user, created_at);
create index if not exists messages_space_idx on public.messages (space_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Private activity stays private
--
--    A profile shows a public portfolio to anyone. Everything else — who
--    someone is connected to, what Spaces they're in — is only visible to
--    the person themselves and, where it concerns you, to you.
--    Posts already restrict themselves by `visibility`; this makes
--    'friends' mean "people I've accepted", which previously meant nothing.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience"
  on public.posts for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (visibility = 'friends' and public.are_connected(user_id, auth.uid()))
  );
