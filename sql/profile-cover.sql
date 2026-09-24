-- Sushii: editable cover — the paginated studio view's own cover state,
-- separate from the everyday Shelf's plain name/bio.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- All three nullable, all three fall back sensibly when unset (see
-- Studio.tsx): cover_title -> display_name, cover_tagline -> bio,
-- cover_post_id -> the owner's own most-recently-pinned Moment. No new RLS
-- needed: "profiles are readable when signed in" and "you edit your own
-- profile" (sql/people.sql) already cover these like every other profile
-- field.
alter table public.profiles add column if not exists cover_title text;
alter table public.profiles add column if not exists cover_tagline text;
alter table public.profiles add column if not exists cover_post_id bigint references public.posts (id) on delete set null;
