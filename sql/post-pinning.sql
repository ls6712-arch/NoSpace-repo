-- Sushii: pinning — feature a Moment first on your own Shelf.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- No new RLS needed: "own posts are editable" (sql/people.sql's sibling
-- policy on public.posts, `using (auth.uid() = user_id) with check
-- (auth.uid() = user_id)`) already restricts every UPDATE — this column
-- included — to the post's own owner. Postgres RLS is row-level, not
-- column-level, so that existing policy already is "only the post's owner
-- can toggle it."
alter table public.posts add column if not exists pinned boolean not null default false;

create index if not exists posts_pinned_idx on public.posts (user_id, pinned);
