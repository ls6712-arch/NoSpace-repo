-- Rollback for 20260924095000_spaces_rework_cleanup.sql.
--
-- Draft only — staged for review, not run.
--
-- Only usable if 20260924090000_spaces_rework_export.sql ran first and its
-- archive tables (archive.circles_20260924, archive.circle_members_20260924,
-- archive.old_spaces_20260924, archive.old_space_members_20260924) still
-- exist. Also only meaningful if run BEFORE 20260924110000_spaces_rework_
-- schema.sql — that migration creates its own `spaces`/`space_members`/
-- `is_space_member(uuid, uuid)`, which would collide with the bigint-keyed
-- originals this file recreates. Roll that migration back first if it has
-- already run.
--
-- Recreates the dropped schema (copied from sql/circles.sql,
-- sql/circle-threads.sql, sql/connections.sql) and restores the archived
-- rows. Recreates only what 20260924095000 actually dropped — not
-- circle_invites (never existed live) or thoughts.media_url (general-
-- purpose, never touched).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Circles
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.circles (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  hobby_slug text not null,
  name text not null,
  location text,
  description text not null,
  purpose text not null,
  prompt text not null default 'What are you working on this week?',
  rules text[] not null default array[
    'Be the kind of member you''d want to find here.',
    'Keep it about the doing, not the selling.'
  ],
  visibility text not null default 'Open to read'
    check (visibility in ('Open to read', 'Members only')),
  created_at timestamptz not null default now()
);
alter table public.circles enable row level security;

create table if not exists public.circle_members (
  circle_id bigint not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
alter table public.circle_members enable row level security;

-- Restore data before re-adding the identity-generated id's sequence could
-- diverge from what was archived.
insert into public.circles overriding system value
  select * from archive.circles_20260924
  on conflict (id) do nothing;
insert into public.circle_members
  select * from archive.circle_members_20260924
  on conflict (circle_id, user_id) do nothing;
select setval(pg_get_serial_sequence('public.circles', 'id'), coalesce((select max(id) from public.circles), 1));

create or replace function public.owns_circle(c bigint, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner = u);
$$;

create or replace function public.is_circle_member(c bigint, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_members m where m.circle_id = c and m.user_id = u);
$$;

drop policy if exists "circles are readable when signed in" on public.circles;
create policy "circles are readable when signed in"
  on public.circles for select using (auth.uid() is not null);

drop policy if exists "you create your own circle" on public.circles;
create policy "you create your own circle"
  on public.circles for insert to authenticated with check (owner = auth.uid());

drop policy if exists "the owner edits their own circle" on public.circles;
create policy "the owner edits their own circle"
  on public.circles for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "you see the roster of a circle you're in" on public.circle_members;
create policy "you see the roster of a circle you're in"
  on public.circle_members for select
  using (
    user_id = auth.uid()
    or public.is_circle_member(circle_id, auth.uid())
    or public.owns_circle(circle_id, auth.uid())
  );

drop policy if exists "you can join a circle yourself" on public.circle_members;
create policy "you can join a circle yourself"
  on public.circle_members for insert to authenticated
  with check (user_id = auth.uid() and (role = 'member' or public.owns_circle(circle_id, auth.uid())));

drop policy if exists "you can leave a circle" on public.circle_members;
create policy "you can leave a circle"
  on public.circle_members for delete using (user_id = auth.uid());

create or replace function public.real_circle_member_counts()
returns table(circle_id bigint, member_count bigint)
language sql stable security definer set search_path = public as $$
  select circle_id, count(*) as member_count from public.circle_members group by circle_id;
$$;
grant execute on function public.real_circle_member_counts() to anon, authenticated;

create or replace function public.rl_circles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circles_insert', 5, interval '1 day');
  return new;
end;
$$;
create trigger rl_circles_insert before insert on public.circles
  for each row execute function public.rl_circles();

create or replace function public.rl_circle_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circle_members_insert', 30, interval '1 hour');
  return new;
end;
$$;
create trigger rl_circle_members_insert before insert on public.circle_members
  for each row execute function public.rl_circle_members();

-- posts: circle-thread columns.
alter table public.posts add column if not exists circle_id bigint;
alter table public.posts add column if not exists circle_tab text;
alter table public.posts drop constraint if exists posts_circle_tab_check;
alter table public.posts add constraint posts_circle_tab_check
  check (circle_tab is null or circle_tab in ('updates', 'pursuits', 'questions', 'events'));
alter table public.posts add column if not exists answered boolean not null default false;
alter table public.posts add column if not exists hidden_from_moments boolean not null default false;
create index if not exists posts_circle_idx on public.posts (circle_id, circle_tab, created_at desc);

-- Restore circle_id/circle_tab/hidden_from_moments for posts that were
-- only unlinked (still exist, per the cleanup migration's "kept" branch)...
update public.posts p
set circle_id = a.circle_id,
    circle_tab = a.circle_tab,
    hidden_from_moments = a.hidden_from_moments
from archive.circle_linked_posts_20260924 a
where p.id = a.id;

-- ...and re-insert the ones that were hard-deleted (the cleanup
-- migration's "Circle-only thread/Update" branch) — these ids no longer
-- exist in public.posts at all.
insert into public.posts
select a.* from archive.circle_linked_posts_20260924 a
where not exists (select 1 from public.posts p where p.id = a.id);

create or replace function public.set_thread_answered(p_post_id bigint, p_answered boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_circle bigint;
begin
  select user_id, circle_id into v_owner, v_circle from public.posts where id = p_post_id;
  if v_owner is null then
    return false;
  end if;
  if auth.uid() is distinct from v_owner
     and (v_circle is null or not public.owns_circle(v_circle, auth.uid())) then
    return false;
  end if;
  update public.posts set answered = p_answered where id = p_post_id;
  return true;
end;
$$;
grant execute on function public.set_thread_answered(bigint, boolean) to authenticated;

drop policy if exists "circle threads follow the circle's visibility" on public.posts;
create policy "circle threads follow the circle's visibility"
  on public.posts for select
  using (
    visibility <> 'circle'
    or circle_id is null
    or not exists (
      select 1 from public.circles ci where ci.id = posts.circle_id and ci.visibility = 'Members only'
    )
    or auth.uid() = user_id
    or public.owns_circle(circle_id, auth.uid())
    or public.is_circle_member(circle_id, auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. sql/connections.sql's spaces/space_members/is_space_member, and the
--    messages columns/policies.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.spaces (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
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
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_members enable row level security;

insert into public.spaces overriding system value
  select * from archive.old_spaces_20260924
  on conflict (id) do nothing;
insert into public.space_members
  select * from archive.old_space_members_20260924
  on conflict (space_id, user_id) do nothing;
select setval(pg_get_serial_sequence('public.spaces', 'id'), coalesce((select max(id) from public.spaces), 1));

create or replace function public.is_space_member(s bigint, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
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
    or exists (select 1 from public.space_members m where m.space_id = spaces.id and m.user_id = auth.uid())
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

alter table public.messages add column if not exists space_id bigint references public.spaces (id) on delete cascade;
create index if not exists messages_space_idx on public.messages (space_id, created_at);

drop policy if exists "you read messages meant for you" on public.messages;
create policy "you read messages meant for you"
  on public.messages for select
  using (
    (
      to_user is not null
      and (auth.uid() = from_user or auth.uid() = to_user)
      and public.are_connected(from_user, to_user)
    )
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
