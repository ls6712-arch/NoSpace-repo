-- Sushii: Spaces Rework — the new Space (host-created community), its
-- membership, host invites, deletion-approval flow, and the Space<->Moment
-- link. Brand-new tables, not a rename of the Circle tables — Circles are
-- being retired and exported separately (see the Phase 2 migration note at
-- the bottom of this file); this is a clean break, built with the same RLS
-- shape sql/circles.sql already proved out (owner/member SECURITY DEFINER
-- helpers to dodge policy self-recursion), not a reuse of its tables.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924090000_spaces_rework_export.sql,
--   20260924095000_spaces_rework_cleanup.sql,
--   20260924098000_spaces_rework_app_config.sql (section 6 below reads
--   public.is_blocklisted_name(), defined there), and
--   20260924100000_spaces_rework_visibility.sql — in that order. The
--   cleanup step is not optional: this database already has an unrelated,
--   never-wired-into-any-UI `spaces`/`space_members`/`is_space_member`
--   (sql/connections.sql) that collides by name with what this file
--   creates. If those old objects are still around, this file's
--   `create table if not exists public.spaces (...)` silently no-ops
--   instead of creating the new table.
--
-- Spec change (Categories internal-only, Corners carry discovery): a
-- Space's category is now derived from its Corners, not picked directly —
-- see section 6 (space_corners) below. `category_slug` is nullable for
-- that reason: it's set by a trigger once the Space's primary Corner is
-- linked, not at the moment the Space row itself is inserted (Create
-- Space's own flow, Phase 5, creates the space row and its space_corners
-- rows as separate statements — there's a brief in-between where a Space
-- exists with no category yet, same as it briefly has zero Corners; both
-- are the app's responsibility to close in the same flow, not something
-- this schema can enforce synchronously across two separate inserts).
--
-- Purely additive: new tables only, nothing existing is altered. Safe to
-- re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Spaces
-- ─────────────────────────────────────────────────────────────────────────
-- No pre-flight blocklist check needed here the way 20260924099000_corners
-- has one for public.corners: this CREATE TABLE only ever runs against a
-- table that doesn't exist yet (the old sql/connections.sql `spaces` was
-- already dropped by 20260924095000_cleanup, and no Space has ever been
-- created under this new schema) — there's no existing row that could
-- violate the constraint below.
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 80)
    check (not public.is_blocklisted_name(name)),
  description text not null check (char_length(description) <= 100),
  cover_image text not null,
  -- References the unified Category model (src/app/data/hobbies.ts's
  -- `hobbies` array, admin-extended via public.categories) by slug — never
  -- a hard FK, since the built-in fifteen aren't rows in this database.
  -- Nullable and derived, not chosen: set by sync_space_category_from_
  -- corner() (section 6) from this Space's primary Corner, once one is
  -- linked via space_corners. Categories are internal-only now — nobody
  -- picks this directly.
  category_slug text,
  meets text not null check (meets in ('in_person', 'online', 'both')),
  -- Public location: neighborhood + city only. The exact address is never
  -- stored here — RLS is row-level and can't hide one column from part of
  -- a row's readers, so it lives in space_private_details below instead.
  neighborhood text,
  city text,
  access text not null default 'open' check (access in ('open', 'closed')),
  -- Up to 3 questions, only meaningful when access = 'closed'.
  join_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(join_questions) = 'array' and jsonb_array_length(join_questions) <= 3),
  rules text,
  member_cap integer check (member_cap is null or member_cap > 0),
  posting_mode text not null default 'immediate' check (posting_mode in ('immediate', 'approval')),
  events_created_by text not null default 'hosts' check (events_created_by in ('hosts', 'members')),
  -- Studio listing — in-person only, information-only until marketplaceEnabled.
  studio_hours text,
  studio_capacity integer check (studio_capacity is null or studio_capacity > 0),
  studio_hourly_rate numeric check (studio_hourly_rate is null or studio_hourly_rate >= 0),
  status text not null default 'active' check (status in ('active', 'read_only', 'deleted')),
  created_by uuid not null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists spaces_category_idx on public.spaces (category_slug);
create index if not exists spaces_status_idx on public.spaces (status);

-- Exact address: members-only (and, for a specific event, a "going" RSVP —
-- see the events migration). Never selected by a query that also returns
-- rows to non-members, which is the whole reason this isn't just a column
-- on spaces with a stricter policy.
create table if not exists public.space_private_details (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  exact_address text
);

alter table public.spaces enable row level security;
alter table public.space_private_details enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Membership
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  status text not null default 'active' check (status in ('active', 'pending', 'banned')),
  -- Answers to the Space's join_questions, in the same order. Only ever
  -- set for a Closed Space's request; null for an Open Space's instant join.
  join_answers jsonb,
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_idx on public.space_members (user_id, status);

alter table public.space_members enable row level security;

-- Security definer so policies can ask "is this person a member/host of
-- this Space?" without recursing into space_members' own policy — same
-- shape as sql/circles.sql's owns_circle()/is_circle_member().
create or replace function public.is_space_member(sid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = sid and user_id = uid and status = 'active'
  );
$$;

create or replace function public.is_space_host(sid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = sid and user_id = uid and role = 'host' and status = 'active'
  );
$$;

create or replace function public.space_host_count(sid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from space_members
  where space_id = sid and role = 'host' and status = 'active';
$$;

revoke all on function public.is_space_member(uuid, uuid) from public;
revoke all on function public.is_space_host(uuid, uuid) from public;
revoke all on function public.space_host_count(uuid) from public;
grant execute on function public.is_space_member(uuid, uuid) to authenticated, anon;
grant execute on function public.is_space_host(uuid, uuid) to authenticated, anon;
grant execute on function public.space_host_count(uuid) to authenticated;

-- Spaces: Open ones are visible to anyone; Closed ones show their public
-- fields to anyone too (name/description/cover/category/city/hosts/event
-- titles per the spec) — the *access* difference is enforced on Moments and
-- event details, not on the Space row itself, so this policy is broad by
-- design.
drop policy if exists "spaces are publicly readable" on public.spaces;
create policy "spaces are publicly readable"
  on public.spaces for select using (status <> 'deleted');

drop policy if exists "signed-in users create a space" on public.spaces;
create policy "signed-in users create a space"
  on public.spaces for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "hosts edit their space" on public.spaces;
create policy "hosts edit their space"
  on public.spaces for update to authenticated
  using (public.is_space_host(id, auth.uid()))
  with check (public.is_space_host(id, auth.uid()));

drop policy if exists "members read the exact address" on public.space_private_details;
create policy "members read the exact address"
  on public.space_private_details for select to authenticated
  using (public.is_space_member(space_id, auth.uid()));

drop policy if exists "hosts set the exact address" on public.space_private_details;
create policy "hosts set the exact address"
  on public.space_private_details for all to authenticated
  using (public.is_space_host(space_id, auth.uid()))
  with check (public.is_space_host(space_id, auth.uid()));

drop policy if exists "members see the roster" on public.space_members;
create policy "members see the roster"
  on public.space_members for select to authenticated
  using (user_id = auth.uid() or public.is_space_member(space_id, auth.uid()));

-- Open: anyone signed in joins directly (status = 'active'). Closed: a
-- request lands as 'pending' for hosts to approve — enforced by requiring
-- the inserted row's own status match the Space's access, checked in the
-- same statement rather than trusted from the client.
drop policy if exists "join or request to join" on public.space_members;
create policy "join or request to join"
  on public.space_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (
          (s.access = 'open' and status = 'active')
          or (s.access = 'closed' and status = 'pending')
        )
    )
  );

drop policy if exists "hosts manage members, members manage themselves" on public.space_members;
create policy "hosts manage members, members manage themselves"
  on public.space_members for update to authenticated
  using (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));

drop policy if exists "leave or be removed" on public.space_members;
create policy "leave or be removed"
  on public.space_members for delete to authenticated
  using (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Host invites — co-hosting an existing member, who must accept.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_host_invites (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.spaces (id) on delete cascade,
  invited_user_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (space_id, invited_user_id, status)
);

alter table public.space_host_invites enable row level security;

drop policy if exists "hosts and the invitee see the invite" on public.space_host_invites;
create policy "hosts and the invitee see the invite"
  on public.space_host_invites for select to authenticated
  using (invited_user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));

drop policy if exists "hosts invite co-hosts" on public.space_host_invites;
create policy "hosts invite co-hosts"
  on public.space_host_invites for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_space_host(space_id, auth.uid())
    and public.is_space_member(space_id, invited_user_id)
    -- Max 5 hosts per Space — checked here too, not just in the app, so a
    -- race between two invites can't slip past it.
    and public.space_host_count(space_id) < 5
  );

drop policy if exists "the invitee answers" on public.space_host_invites;
create policy "the invitee answers"
  on public.space_host_invites for update to authenticated
  using (invited_user_id = auth.uid())
  with check (invited_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Deletion requests — every host must approve, 7-day window per host.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_deletion_requests (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.spaces (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled')),
  created_at timestamptz not null default now(),
  -- A decline, or silence past this, cancels the request (app-enforced —
  -- see the app-level sweep that flips overdue requests to 'cancelled').
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists public.space_deletion_approvals (
  deletion_request_id bigint not null references public.space_deletion_requests (id) on delete cascade,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'declined')),
  responded_at timestamptz,
  primary key (deletion_request_id, host_user_id)
);

alter table public.space_deletion_requests enable row level security;
alter table public.space_deletion_approvals enable row level security;

drop policy if exists "hosts see deletion requests" on public.space_deletion_requests;
create policy "hosts see deletion requests"
  on public.space_deletion_requests for select to authenticated
  using (public.is_space_host(space_id, auth.uid()));

drop policy if exists "a host starts a deletion request" on public.space_deletion_requests;
create policy "a host starts a deletion request"
  on public.space_deletion_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_space_host(space_id, auth.uid()));

drop policy if exists "hosts see and answer their own approval row" on public.space_deletion_approvals;
create policy "hosts see and answer their own approval row"
  on public.space_deletion_approvals for select to authenticated
  using (
    host_user_id = auth.uid()
    or exists (
      select 1 from space_deletion_requests r
      where r.id = deletion_request_id and public.is_space_host(r.space_id, auth.uid())
    )
  );

drop policy if exists "a host answers their own approval row" on public.space_deletion_approvals;
create policy "a host answers their own approval row"
  on public.space_deletion_approvals for update to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Space <-> Moment link. A Moment's Category tag (posts.hobby_slug) is
--    unrelated and untouched — this is the separate "posted into / featured
--    by this Space" relationship the spec calls for.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_moments (
  space_id uuid not null references public.spaces (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  featured boolean not null default false,
  removed_by_host boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (space_id, post_id)
);
create index if not exists space_moments_space_idx on public.space_moments (space_id, added_at);
-- At most one featured Moment per Space — featuring a new one un-features
-- the old one (app-enforced: unset the previous row's featured flag in the
-- same transaction as setting the new one).
create unique index if not exists space_moments_one_featured
  on public.space_moments (space_id) where featured = true;

alter table public.space_moments enable row level security;

drop policy if exists "space moments follow the space's access" on public.space_moments;
create policy "space moments follow the space's access"
  on public.space_moments for select
  using (
    removed_by_host = false
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (s.access = 'open' or public.is_space_member(s.id, auth.uid()))
    )
  );

drop policy if exists "the poster or a host links/unlinks a moment" on public.space_moments;
create policy "the poster or a host links/unlinks a moment"
  on public.space_moments for insert to authenticated
  with check (
    public.is_space_member(space_id, auth.uid())
    and exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "hosts feature or remove, the poster unlinks their own" on public.space_moments;
create policy "hosts feature or remove, the poster unlinks their own" on public.space_moments;
create policy "hosts feature or remove, the poster unlinks their own"
  on public.space_moments for update to authenticated
  using (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  )
  with check (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "hosts or the poster delete the link" on public.space_moments;
create policy "hosts or the poster delete the link"
  on public.space_moments for delete to authenticated
  using (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Space <-> Corner link. Corners are the only browse/tag label a user
--    ever picks; a Space's Category is derived from these, never chosen
--    directly (spec change: Categories are internal-only). Create Space
--    (Phase 5) requires 1-3 Corners, at least 1 of them primary. The
--    "at least 1" half of that isn't enforceable synchronously here (see
--    the header note on category_slug) — Phase 5's Create Space flow is
--    responsible for always linking a Corner in the same user action that
--    creates the Space. The "at most 3" half is enforced below.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_corners (
  space_id uuid not null references public.spaces (id) on delete cascade,
  corner_id bigint not null references public.corners (id) on delete cascade,
  -- Exactly one true per Space — the Corner spaces.category_slug is
  -- derived from. Phase 5's Create Space form sets this on whichever
  -- Corner is listed first; admin Corner merges (sql/corners-admin.sql,
  -- Phase 3-ish) may need to re-point this if the primary Corner itself
  -- gets merged away.
  is_primary boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (space_id, corner_id)
);
create unique index if not exists space_corners_one_primary
  on public.space_corners (space_id) where is_primary;
create index if not exists space_corners_corner_idx on public.space_corners (corner_id);

alter table public.space_corners enable row level security;

drop policy if exists "space corners are as visible as the space" on public.space_corners;
create policy "space corners are as visible as the space"
  on public.space_corners for select
  using (exists (select 1 from spaces s where s.id = space_id and s.status <> 'deleted'));

drop policy if exists "hosts manage their space's corners" on public.space_corners;
create policy "hosts manage their space's corners"
  on public.space_corners for all to authenticated
  using (public.is_space_host(space_id, auth.uid()))
  with check (public.is_space_host(space_id, auth.uid()));

-- At most 3 Corners per Space.
create or replace function public.check_space_corners_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from space_corners where space_id = new.space_id) >= 3 then
    raise exception 'A Space can have at most 3 Corners.';
  end if;
  return new;
end;
$$;
drop trigger if exists space_corners_limit on public.space_corners;
create trigger space_corners_limit
  before insert on public.space_corners
  for each row execute function public.check_space_corners_limit();

-- Keep spaces.category_slug in sync with the primary Corner's own
-- category (corners.space_slug — that column already means "category
-- slug" in the merged model; see Q3 of this rework's own decisions for
-- why it isn't renamed).
create or replace function public.sync_space_category_from_corner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_category text;
begin
  v_space_id := coalesce(new.space_id, old.space_id);

  if tg_op <> 'DELETE' and new.is_primary then
    -- This row is (now) the primary Corner — derive straight from it.
    -- A non-primary insert/update (the 2nd or 3rd Corner on a Space)
    -- falls through and leaves category_slug untouched, on purpose.
    select c.space_slug into v_category from corners c where c.id = new.corner_id;
    update spaces set category_slug = v_category where id = v_space_id;
  elsif (tg_op = 'DELETE' and old.is_primary)
     or (tg_op = 'UPDATE' and old.is_primary and not new.is_primary) then
    -- The primary Corner was unlinked or demoted with no replacement in
    -- this same row. Fall back to another linked Corner if one exists;
    -- otherwise the Space is left without a category until a new primary
    -- is set — the app's job is to always pair "unset the old primary"
    -- with "set a new one" in the same flow, same as it must always keep
    -- at least 1 Corner linked in the first place (see this section's
    -- header note).
    select c.space_slug into v_category
    from space_corners sc join corners c on c.id = sc.corner_id
    where sc.space_id = v_space_id and sc.corner_id <> old.corner_id
    order by sc.added_at
    limit 1;
    update spaces set category_slug = v_category where id = v_space_id;
  end if;

  return coalesce(new, old);
end;
$$;
drop trigger if exists space_corners_sync_category on public.space_corners;
create trigger space_corners_sync_category
  after insert or update or delete on public.space_corners
  for each row execute function public.sync_space_category_from_corner();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Reserved slugs — the 15 Category slugs and the 8 legacy Space slugs
--    (src/app/data/hobbies.ts's LEGACY_SPACES) can never be taken by a new
--    Space, since /space/:slug now routes to a real Space and those slugs
--    already redirect to Discover. Checked at creation time by the app
--    (Phase 5's Create Space form) against this function, not only in SQL —
--    but enforced here too, so a slug can't slip through a direct API call.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_reserved_space_slug(check_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_slug in (
    'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
    'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
    'music', 'photography-film', 'health-wellness', 'fashion-beauty',
    'tech-building', 'collecting-fandom', 'travel-adventure',
    'workbench', 'makerlab', 'buildstack', 'inmotion', 'kitchentable',
    'rooted', 'thestudio', 'rabbithole'
  )
  -- Plus any admin-added, database-only Category slug (public.categories,
  -- sql/categories.sql) — those aren't in the hardcoded list above.
  or exists (select 1 from categories c where c.slug = check_slug);
$$;
revoke all on function public.is_reserved_space_slug(text) from public;
grant execute on function public.is_reserved_space_slug(text) to authenticated, anon;

alter table public.spaces drop constraint if exists spaces_slug_not_reserved;
alter table public.spaces add constraint spaces_slug_not_reserved
  check (not public.is_reserved_space_slug(slug));
