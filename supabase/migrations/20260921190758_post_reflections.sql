-- Owner-only Reflections, split out of public.posts. See docs/moment-
-- card-and-reactions-spec.md's #86 (My Space / You redesign follow-up).
--
-- posts.reflection was returned to EVERY viewer who could read the row at
-- all, not just its owner: a feed's `select("*")` put a stranger's private
-- words on the wire even though no UI ever rendered them for anyone but
-- the owner. Row Level Security gates ROWS, never columns, so RLS on
-- `posts` alone could never close this — the value has to live somewhere
-- RLS actually can gate: its own table, one row per post, readable and
-- writable by that post's owner only.
create table if not exists public.post_reflections (
  post_id bigint primary key references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reflection text not null,
  updated_at timestamptz not null default now()
);

alter table public.post_reflections enable row level security;

create policy "you manage your own reflections"
  on public.post_reflections for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Copy any existing values across before the source column is cleared.
-- (0 rows qualify on the live project as of this migration — nobody has
-- written a Reflection yet — but this has to be correct for real data.)
insert into public.post_reflections (post_id, user_id, reflection, updated_at)
select id, user_id, reflection, created_at
from public.posts
where reflection is not null and reflection <> ''
on conflict (post_id) do nothing;

-- The column stays (no drop without confirmation — see this branch's own
-- convention on post_likes/likes) but its data doesn't: post_reflections
-- is the only place a Reflection lives from here on, and application code
-- (ContentContext.tsx) no longer reads or writes posts.reflection at all.
update public.posts set reflection = null where reflection is not null;
