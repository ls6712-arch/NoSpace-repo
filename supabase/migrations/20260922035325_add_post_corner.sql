-- Corner gets its own field on posts, independent of sub_hobby.
--
-- Discover's masonry redesign (redesign/discover-masonry) used sub_hobby as
-- both "the specific craft/hobby this Moment is" (Woodwork) and "which
-- Corner it's filed under for browsing" (Gift-making) — the same value
-- doing two jobs that don't always agree. This splits them: corner is the
-- new, independent field a Moment's Corner-browsing identity comes from;
-- sub_hobby keeps meaning exactly what it always has (badges, Pursuits, the
-- Shelf's grouping) and is untouched.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved.
--
-- ── UP ──────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists corner text;

-- One-time backfill: every existing post's corner starts out equal to
-- whatever sub_hobby it already had, so nothing already tagged into a
-- Corner via sub_hobby stops showing up under it the moment this ships. A
-- post written after this migration sets corner independently (or not at
-- all) — this backfill only ever runs the one time, against rows that
-- predate it (corner is null, sub_hobby isn't).
update public.posts
set corner = sub_hobby
where corner is null and sub_hobby is not null;

-- sql/corners.sql's sync_corner_moment_count trigger keyed moment_count
-- purely off sub_hobby. Re-defined here to read corner first and fall back
-- to sub_hobby (coalesce), the same fallback order postCorner() in
-- src/app/data/posts.ts uses on the client — so a Moment tagged only via
-- the new corner field counts, and a legacy Moment relying on sub_hobby
-- alone still counts exactly as it did before. Every old.x/new.x reference
-- stays inside its own tg_op branch (never evaluated for the op it doesn't
-- apply to) — NEW is unassigned during a DELETE and OLD is unassigned
-- during an INSERT, so reading either out of turn raises at runtime.
create or replace function public.sync_corner_moment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    if coalesce(old.corner, old.sub_hobby) is not null and old.visibility = 'public' then
      update public.corners set moment_count = greatest(moment_count - 1, 0)
        where space_slug = old.hobby_slug and slug = coalesce(old.corner, old.sub_hobby);
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if coalesce(old.corner, old.sub_hobby) is distinct from coalesce(new.corner, new.sub_hobby)
       or old.hobby_slug is distinct from new.hobby_slug
       or old.visibility is distinct from new.visibility then
      if coalesce(old.corner, old.sub_hobby) is not null and old.visibility = 'public' then
        update public.corners set moment_count = greatest(moment_count - 1, 0)
          where space_slug = old.hobby_slug and slug = coalesce(old.corner, old.sub_hobby);
      end if;
      if coalesce(new.corner, new.sub_hobby) is not null and new.visibility = 'public' then
        insert into public.corners (space_slug, slug, name, moment_count)
        values (new.hobby_slug, coalesce(new.corner, new.sub_hobby), coalesce(new.corner, new.sub_hobby), 1)
        on conflict (space_slug, slug)
          do update set moment_count = public.corners.moment_count + 1;
      end if;
    end if;
    return new;
  end if;

  -- INSERT
  if coalesce(new.corner, new.sub_hobby) is not null and new.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (new.hobby_slug, coalesce(new.corner, new.sub_hobby), coalesce(new.corner, new.sub_hobby), 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  return new;
end;
$$;

-- The trigger itself (sql/corners.sql) already points at this function by
-- name and doesn't need to be recreated — create or replace above is
-- enough to swap its body in place.
