-- BACKFILL: Circles' base schema predates this repo's supabase/migrations/
-- directory entirely — like set_thread_answered() (20260913195100), it was
-- never created by any tracked migration, but several real, already-applied
-- migrations assume it exists:
--   - 20260919063618_fix_post_read_policy_live_schema.sql (and its later
--     replacement, 20260920115108_consolidate_visibility_policies.sql, the
--     correctly-numbered sibling of 20260919230100) CREATE POLICY against
--     `public.circles` and call `private.is_circle_member(bigint, uuid)` —
--     both are validated at CREATE POLICY time, not deferred, so both must
--     already exist for those migrations to have applied live in the first
--     place.
--   - 20260913195100_create_set_thread_answered.sql's function body calls
--     public.owns_circle(), which (being PL/pgSQL) isn't validated until
--     call time, so it didn't block that backfill, but still needs to
--     eventually resolve to something real.
--
-- Tables, owns_circle()/is_circle_member() and their policies are backfilled
-- verbatim from sql/circles.sql (sections 1-4), which is still in this repo.
-- The posts columns are backfilled verbatim from sql/circle-threads.sql
-- (section 1), minus set_thread_answered() itself (already backfilled at
-- 20260913195100) and thoughts.media_url (nothing in tracked migration
-- history depends on it, so it's left out of scope here).
--
-- private.is_circle_member(bigint, uuid) is NOT in sql/circles.sql — that
-- file only defines public.is_circle_member(). But the real, tracked
-- policies (20260919063618, 20260920115108) call private.is_circle_member,
-- and 20261009000000_remove_circles.sql's drop list confirms both
-- public.is_circle_member AND private.is_circle_member existed live, so at
-- some point this got mirrored into `private` the same way private.is_admin
-- mirrors public functions elsewhere in this codebase. No source file for
-- that mirror survives, so its body here is inferred to match
-- public.is_circle_member's logic exactly — same shape as the public one,
-- just in the other schema. private.owns_circle is only ever referenced in
-- an `if exists` drop, never in anything that validates it at creation
-- time, so it's left out rather than guessed at.

-- ─────────────────────────────────────────────────────────────────────────
-- posts columns (sql/circle-threads.sql section 1, minus set_thread_answered
-- and thoughts.media_url — see header).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists circle_id bigint;

alter table public.posts add column if not exists circle_tab text;
alter table public.posts drop constraint if exists posts_circle_tab_check;
alter table public.posts
  add constraint posts_circle_tab_check
  check (circle_tab is null or circle_tab in ('updates', 'pursuits', 'questions', 'events'));

alter table public.posts add column if not exists answered boolean not null default false;
alter table public.posts add column if not exists hidden_from_moments boolean not null default false;

create index if not exists posts_circle_idx on public.posts (circle_id, circle_tab, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- circles / circle_members (sql/circles.sql sections 1-4).
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

create index if not exists circles_hobby_idx on public.circles (hobby_slug);
create index if not exists circle_members_user_idx on public.circle_members (user_id);

create or replace function public.owns_circle(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner = u);
$$;

create or replace function public.is_circle_member(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m where m.circle_id = c and m.user_id = u
  );
$$;

-- Mirror into `private` — see header. Same body as public.is_circle_member.
create or replace function private.is_circle_member(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m where m.circle_id = c and m.user_id = u
  );
$$;

drop policy if exists "circles are visible to everyone" on public.circles;
drop policy if exists "circles are readable when signed in" on public.circles;
create policy "circles are readable when signed in"
  on public.circles for select
  using (auth.uid() is not null);

drop policy if exists "you create your own circle" on public.circles;
create policy "you create your own circle"
  on public.circles for insert to authenticated
  with check (owner = auth.uid());

drop policy if exists "the owner edits their own circle" on public.circles;
create policy "the owner edits their own circle"
  on public.circles for update
  using (owner = auth.uid()) with check (owner = auth.uid());

revoke update (owner) on public.circles from authenticated;

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
  with check (
    user_id = auth.uid()
    and (role = 'member' or public.owns_circle(circle_id, auth.uid()))
  );

revoke update (circle_id, user_id, role) on public.circle_members from authenticated;

drop policy if exists "you can leave a circle" on public.circle_members;
create policy "you can leave a circle"
  on public.circle_members for delete
  using (user_id = auth.uid());

-- Circle-thread read gating (sql/circles.sql section 5) — superseded by
-- 20260919063618_fix_post_read_policy_live_schema.sql shortly after this
-- point in history, which drops this exact policy name. Created here
-- anyway for historical accuracy; the later migration's DROP IF EXISTS
-- handles the handoff cleanly either way.
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

create or replace function public.real_circle_member_counts()
returns table(circle_id bigint, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select circle_id, count(*) as member_count
  from public.circle_members
  group by circle_id;
$$;
grant execute on function public.real_circle_member_counts() to anon, authenticated;

create or replace function public.rl_circles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circles_insert', 5, interval '1 day');
  return new;
end;
$$;
drop trigger if exists rl_circles_insert on public.circles;
create trigger rl_circles_insert before insert on public.circles
  for each row execute function public.rl_circles();

create or replace function public.rl_circle_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circle_members_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_circle_members_insert on public.circle_members;
create trigger rl_circle_members_insert before insert on public.circle_members
  for each row execute function public.rl_circle_members();
