-- NoSpace: turn Circles into a real discussion board — threaded posts,
-- tabs, a "mark answered" state, and photo replies.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run this before circles.sql (it doesn't depend on the new
-- circles/circle_members tables, but circles.sql's own comments assume
-- these columns already exist on posts).
--
-- Naming note: this repo's own convention keeps every migration under
-- sql/<name>.sql (see the rest of this directory), not supabase/NNNN_*.sql —
-- this file and circles.sql follow that existing convention instead.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. posts: which Circle a thread belongs to, which tab it's filed under,
--    whether a question's been answered, and whether it should stay out of
--    the poster's own public Moments shelf.
-- ─────────────────────────────────────────────────────────────────────────

-- No foreign key to circles(id) on purpose: circle_id lives in the same
-- mixed id space the app already uses everywhere else (src/app/data/
-- circles.ts's hand-picked seed ids like 1, 2, 5 alongside real circles.sql
-- rows, which the client offsets by 1,000,000 before this column ever sees
-- them — see CirclesContext.tsx). A seed circle has no row in `circles` at
-- all, so a strict FK would reject every seed-circle post.
alter table public.posts add column if not exists circle_id bigint;

alter table public.posts add column if not exists circle_tab text;
alter table public.posts
  drop constraint if exists posts_circle_tab_check;
alter table public.posts
  add constraint posts_circle_tab_check
  check (circle_tab is null or circle_tab in ('updates', 'pursuits', 'questions', 'events'));

alter table public.posts add column if not exists answered boolean not null default false;

-- Circle contributions used to have no way to opt out of the poster's own
-- "Your Moments" shelf, so anything posted into a Circle silently doubled
-- as a personal Moment too — the actual bug this column fixes. Defaults to
-- false at the column level (existing posts, and every non-Circle post,
-- are completely unaffected); the Circle composer is what actually sets
-- this true unless its own "Also save to Moments" box is checked — see
-- CircleComposer.tsx and ContentContext.tsx's myPosts filter.
alter table public.posts add column if not exists hidden_from_moments boolean not null default false;

create index if not exists posts_circle_idx on public.posts (circle_id, circle_tab, created_at desc);

-- Marking a question answered can come from two different people — the
-- person who asked it, or the Circle's owner moderating the board — and
-- neither already has a blanket UPDATE policy that covers the other's
-- posts. Rather than widen posts' RLS (which would let a Circle owner
-- rewrite a member's caption or photo, not just this one flag), this is a
-- narrow SECURITY DEFINER RPC that only ever touches the `answered` column,
-- same reasoning as circle_member_counts() in circle-invites.sql.
create or replace function public.set_thread_answered(p_post_id bigint, p_answered boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_circle bigint;
begin
  select user_id, circle_id into v_owner, v_circle from public.posts where id = p_post_id;
  if v_owner is null then
    return false;
  end if;
  if auth.uid() is distinct from v_owner
     and (v_circle is null or not public.owns_circle(v_circle, auth.uid())) then
    return false;
  end if;
  update public.posts set answered = p_answered where id = p_post_id;
  return true;
end;
$$;
-- owns_circle() is defined in circles.sql, run after this file — the
-- function body above only resolves it at call time, so the order is safe
-- as long as circles.sql has run before set_thread_answered() is actually
-- invoked (it's re-created there with no changes needed here).
grant execute on function public.set_thread_answered(bigint, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. thoughts: a photo alongside a reply, not just words.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.thoughts add column if not exists media_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns where table_name = 'posts' and column_name in ('circle_id','circle_tab','answered','hidden_from_moments');
-- select column_name from information_schema.columns where table_name = 'thoughts' and column_name = 'media_url';
