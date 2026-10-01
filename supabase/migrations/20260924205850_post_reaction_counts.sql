-- Public reaction counts on every Moment.
--
-- Reverses docs/moment-card-and-reactions-spec.md §4 ("counts are
-- maker-only"), per Sid, Sept 24, 2026: a Moment's Love this / Count me in
-- totals are now shown to anyone who can see the Moment.
--
-- How: two denormalized counters on posts, kept in step by a trigger on
-- public.reactions. Counts therefore ride along with the posts select,
-- which RLS already filters — anyone who can read a Moment can read its
-- totals, and nobody learns anything about a Moment they can't see.
-- public.reactions' own select policy is untouched: *who* reacted stays
-- private to the reactor and the Moment's maker. Thoughts counts are
-- deliberately not included (thoughts can be private — thoughts_private).
--
-- Draft — review, then apply BEFORE the matching client change is
-- deployed. The client falls back safely if these columns are missing,
-- but counts will read as 0 until this is applied.
--
-- ── UP ──────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists love_count integer not null default 0;
alter table public.posts add column if not exists in_count   integer not null default 0;

create or replace function public.sync_post_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if new.type = 'love' then
      update public.posts set love_count = love_count + 1 where id = new.post_id;
    elsif new.type = 'in' then
      update public.posts set in_count = in_count + 1 where id = new.post_id;
    end if;
    return new;
  end if;

  -- DELETE
  if old.type = 'love' then
    update public.posts set love_count = greatest(love_count - 1, 0) where id = old.post_id;
  elsif old.type = 'in' then
    update public.posts set in_count = greatest(in_count - 1, 0) where id = old.post_id;
  end if;
  return old;
end;
$$;

-- A trigger function is never meant to be called directly.
revoke all on function public.sync_post_reaction_counts() from public, anon, authenticated;

drop trigger if exists reactions_sync_counts on public.reactions;
create trigger reactions_sync_counts
  after insert or delete on public.reactions
  for each row execute function public.sync_post_reaction_counts();

-- One-time backfill from the rows that already exist.
update public.posts p
set love_count = coalesce(c.love, 0),
    in_count   = coalesce(c.in_, 0)
from (
  select post_id,
         count(*) filter (where type = 'love') as love,
         count(*) filter (where type = 'in')   as in_
  from public.reactions
  group by post_id
) c
where c.post_id = p.id;
