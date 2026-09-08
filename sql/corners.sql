-- NoSpace: Corners, created by tagging rather than suggest-and-approve.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Independent of the other files.
--
-- A Corner is a specific craft or topic inside a Space (Pottery inside
-- Crafts & Making). The fifteen Spaces stay curated in app code, the same
-- way categories.sql keeps its fifteen built-ins in code — but Corners are
-- deliberately not curated: tagging a Moment with a Corner name that
-- doesn't exist yet in that Space creates it, no moderator, no queue. Each
-- Space's original hand-picked Corners (hobbies.ts's subItems) also stay in
-- code as a permanent baseline, so this table only needs to hold the ones
-- people actually tag — curated or not, a Corner that has real Moments ends
-- up with a real row here regardless, via the trigger below.

create table if not exists public.corners (
  id bigint generated always as identity primary key,
  space_slug text not null,
  slug text not null,
  /** The display name, set once by whoever tagged it first. Later taggers
   * match onto this via the app's own autocomplete rather than creating a
   * near-duplicate, so this rarely needs to change by hand. */
  name text not null,
  /** Public Moments only — see the trigger below for why. Maintained by the
   * trigger, not written directly by the app, so it can't drift the way a
   * client-incremented counter would as Moments are edited or deleted. */
  moment_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (space_slug, slug)
);
alter table public.corners enable row level security;

drop policy if exists "corners are public" on public.corners;
create policy "corners are public"
  on public.corners for select using (true);

-- No approval step, by design: anyone signed in can bring a Corner into
-- existence. There is deliberately no update or delete policy for regular
-- users — moment_count is trigger-maintained, and renaming or removing a
-- Corner is a moderation action for later, not something this migration
-- needs to solve today.
drop policy if exists "anyone signed in can create a corner" on public.corners;
create policy "anyone signed in can create a corner"
  on public.corners for insert to authenticated
  with check (true);

create index if not exists corners_space_idx on public.corners (space_slug, moment_count desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Keep moment_count in sync with posts, automatically.
--
-- Only public Moments count. A Corner's count is visible to every visitor
-- on Discover, signed in or not — counting private, Clan, or Circle-only
-- Moments toward it would leak a signal about someone's non-public activity
-- (that a Corner exists, or is more active than it looks) to people who can
-- never see the Moments themselves. This mirrors how every other aggregate
-- in the app (HobbyActivity, the derived "Projects still moving" clusters)
-- already only ever looks at the public feed.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.sync_corner_moment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    if old.sub_hobby is not null and old.visibility = 'public' then
      update public.corners set moment_count = greatest(moment_count - 1, 0)
        where space_slug = old.hobby_slug and slug = old.sub_hobby;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.sub_hobby is distinct from new.sub_hobby
       or old.hobby_slug is distinct from new.hobby_slug
       or old.visibility is distinct from new.visibility then
      if old.sub_hobby is not null and old.visibility = 'public' then
        update public.corners set moment_count = greatest(moment_count - 1, 0)
          where space_slug = old.hobby_slug and slug = old.sub_hobby;
      end if;
      if new.sub_hobby is not null and new.visibility = 'public' then
        insert into public.corners (space_slug, slug, name, moment_count)
        values (new.hobby_slug, new.sub_hobby, new.sub_hobby, 1)
        on conflict (space_slug, slug)
          do update set moment_count = public.corners.moment_count + 1;
      end if;
    end if;
    return new;
  end if;

  -- INSERT
  if new.sub_hobby is not null and new.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (new.hobby_slug, new.sub_hobby, new.sub_hobby, 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists corners_sync on public.posts;
create trigger corners_sync
  after insert or update or delete on public.posts
  for each row execute function public.sync_corner_moment_count();
