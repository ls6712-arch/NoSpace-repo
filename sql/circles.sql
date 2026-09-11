-- NoSpace: real, user-created Circles — a name, an owner, and members other
-- accounts can actually see, on top of the existing hand-written seed
-- Circles (src/app/data/circles.ts), which stay exactly as they are.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run circle-threads.sql first.
--
-- This repo already hit an RLS recursion bug once from a policy on table A
-- querying table B and vice versa (spaces/space_members — see
-- sql/space-fix.sql: "Postgres detects this and refuses the query
-- outright"). Both cross-table checks here go through SECURITY DEFINER
-- helper functions from the start instead, the same fix space-fix.sql had
-- to apply after the fact.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.circles (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  hobby_slug text not null,
  name text not null,
  -- Undefined/null = global circle, same convention as the seed data's
  -- optional Circle.location.
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

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helpers that don't re-enter row-level security
-- ─────────────────────────────────────────────────────────────────────────

/** Does this person own that Circle? */
create or replace function public.owns_circle(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner = u);
$$;

/** Has this person joined that Circle? */
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Circles — readable by everyone, same as the seed data always was
--    (Circles.tsx and CategoryFeed's Circles tab already list every seed
--    Circle regardless of its own `visibility` label). `visibility` gates
--    reading the Circle's own threads (section 5 below), not whether the
--    Circle shows up in a browse list, and not joining (section 4) — there
--    is no request-to-join flow here, on purpose.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "circles are visible to everyone" on public.circles;
create policy "circles are visible to everyone"
  on public.circles for select
  using (true);

drop policy if exists "you create your own circle" on public.circles;
create policy "you create your own circle"
  on public.circles for insert to authenticated
  with check (owner = auth.uid());

drop policy if exists "the owner edits their own circle" on public.circles;
create policy "the owner edits their own circle"
  on public.circles for update
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Ownership itself never changes after creation — nothing in the app offers
-- transferring a Circle, and letting `owner` move via an update would let
-- someone hand away (or seize) the one column every other policy here keys
-- off of.
revoke update (owner) on public.circles from authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Membership — self-serve to join, self-serve to leave, no approval
--    step. "Members only" restricts reading a Circle's threads once you're
--    not in it; it never restricts joining.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "you see the roster of a circle you're in" on public.circle_members;
create policy "you see the roster of a circle you're in"
  on public.circle_members for select
  using (
    user_id = auth.uid()
    or public.is_circle_member(circle_id, auth.uid())
    or public.owns_circle(circle_id, auth.uid())
  );

-- Anyone can insert themselves as a plain member. The one exception is the
-- 'owner' role row, which only the Circle's actual owner may write for
-- themselves — written once, right after the Circle itself is created —
-- otherwise any signed-in caller could hand-craft an 'owner' row for a
-- Circle they didn't make.
drop policy if exists "you can join a circle yourself" on public.circle_members;
create policy "you can join a circle yourself"
  on public.circle_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and (role = 'member' or public.owns_circle(circle_id, auth.uid()))
  );

-- role/circle_id/user_id are only ever set once, at insert — nothing in the
-- app updates a membership row at all. Locking these at the column-
-- privilege level means nobody can later promote their own row to 'owner'
-- through an update, regardless of what a row-level policy might allow.
revoke update (circle_id, user_id, role) on public.circle_members from authenticated;

-- Leaving never touches `circles.owner` — an owner who leaves their own
-- Circle's member list stays the owner (owns_circle() only ever looks at
-- circles.owner), so they keep every management action this file grants
-- the owner below.
drop policy if exists "you can leave a circle" on public.circle_members;
create policy "you can leave a circle"
  on public.circle_members for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Circle threads — a thread is just a row in `posts` with
--    visibility = 'circle' and circle_id set (see sql/circle-threads.sql).
--    Nothing here restricts who may INSERT one: "you post your own
--    moments" (security-hardening.sql) already covers it, and this feature
--    deliberately has no request-to-join step for reading to gate against
--    either. What this adds is read-time gating for "Members only" Circles.
--
--    IMPORTANT — this policy only actually narrows anything if `posts`
--    doesn't already carry a broader, pre-existing SELECT policy: multiple
--    permissive policies on the same table OR together in Postgres, so an
--    old `using (true)` select policy set up by hand (this repo's posts
--    table predates its own tracked SQL — see security-hardening.sql
--    section 6) would still let anyone read every Circle's threads
--    regardless of this addition. Run the query at the bottom of this file
--    to check what's actually there before relying on "Members only" to
--    mean anything.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "circle threads follow the circle's visibility" on public.posts;
create policy "circle threads follow the circle's visibility"
  on public.posts for select
  using (
    visibility <> 'circle'
    or circle_id is null
    -- A seed Circle (src/app/data/circles.ts) has no row in `circles` at
    -- all — owns_circle/is_circle_member both answer false for an id that
    -- doesn't exist there, which would wrongly hide every seed-Circle
    -- thread. Only gate reading when the id actually resolves to a real,
    -- Members-only Circle.
    or not exists (
      select 1 from public.circles ci where ci.id = posts.circle_id and ci.visibility = 'Members only'
    )
    or auth.uid() = user_id
    or public.owns_circle(circle_id, auth.uid())
    or public.is_circle_member(circle_id, auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 6. A public, row-free member count — the roster select policy above only
--    lets a member or the owner see the actual rows, but a Circle's card
--    needs to show "34 members" to someone who hasn't joined yet, same
--    problem circle_member_counts() (circle-invites.sql) already solved for
--    the older invite-based joins. Different name because that function
--    already exists and counts a different table.
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Rate limiting, same shape as every other insert-heavy table
--    (security-hardening.sql, circle-invites.sql).
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Check it
--
--    Should return one row and no error. If this errors with "infinite
--    recursion detected in policy", something above didn't apply.
-- ─────────────────────────────────────────────────────────────────────────
-- select count(*) as circles_readable from public.circles;
--
-- What's actually gating reads on posts right now — if you see an existing
-- broad select policy here (e.g. `using (true)` with no visibility check),
-- section 5 above is not actually restricting "Members only" Circles yet:
-- select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT';
