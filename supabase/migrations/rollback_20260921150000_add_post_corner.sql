-- Rollback for 20260921150000_add_post_corner.sql.
--
-- Draft only — staged for review, not run. Reverts sync_corner_moment_count
-- to the sub_hobby-only version and drops the corner column.
--
-- This is the one place this pair isn't fully lossless: any Moment given a
-- corner that differs from its sub_hobby (the entire point of the field)
-- has that distinction discarded here — there's nowhere else for it to
-- live once the column is gone. Every pre-existing Moment the up
-- migration's own backfill touched is unaffected either way, since its
-- corner already equalled its sub_hobby before this runs.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
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

alter table public.posts drop column if exists corner;
