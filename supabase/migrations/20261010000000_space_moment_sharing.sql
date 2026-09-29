-- Sushii: Space Moment sharing — adding a Moment to a Space actually shares
-- it with that Space's audience, not just with the Space's own Moments
-- tab/count. Until now "posts are readable by their audience" (the one
-- SELECT policy on public.posts) had no branch for a space_moments link at
-- all — a Moment linked into a Space was only ever readable via its own
-- visibility (public/followers/just_me), same as if it had never been
-- linked. 'space' has been a legal posts.visibility value since
-- 20260924100000_spaces_rework_visibility.sql, but nothing ever gave it (or
-- any other visibility, once linked) a Space-shaped read rule.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924110000_spaces_rework_schema.sql (space_moments,
--   is_space_member, is_space_host) and 20261005000000_spaces_rework_
--   moment_approval.sql (set_space_moment_status, the current live body
--   this migration re-creates with one addition).
--
-- Four things:
--   1. private.post_shared_via_space(post_id, viewer) — a SECURITY DEFINER,
--      STABLE function carrying the "is this post linked into a Space the
--      viewer can see it through" check. This has to live outside the
--      posts policy itself: a branch written inline as
--      `exists (select 1 from space_moments sm join spaces s on ... )`
--      makes evaluating the posts SELECT policy require evaluating
--      space_moments' own SELECT policy ("space moments follow the space's
--      access", 20260925010000) for the pending branch, and THAT policy's
--      pending branch reads posts — Postgres detects that cycle at
--      execution time and every posts read fails outright with "infinite
--      recursion detected in policy for relation posts", not just Space-
--      linked ones. SECURITY DEFINER (owned by the same role that owns
--      space_moments/spaces, same as every other RLS-helper function here —
--      is_space_member, is_space_host, private.is_circle_member before it)
--      queries those two tables with RLS bypassed entirely, the same way
--      is_space_member already does for space_members, so no policy on
--      either table is ever evaluated and the cycle never starts.
--   2. "posts are readable by their audience" — the live author/public/
--      followers branches carried over verbatim, plus one new branch: not
--      just_me, the author's profile visible, and
--      private.post_shared_via_space(posts.id, viewer) true. Every column
--      in rule 1's function body is qualified; the carried-over branches
--      are untouched, unqualified exactly as they are live.
--   3. set_space_moment_status() (the before-insert trigger already on
--      space_moments) rejects linking a just_me Moment, with a message a
--      user would actually read — "Private Moments can't be shared to a
--      Space." — instead of a generic RLS/constraint error. This is the
--      only new write-side rule; rule 2's `visibility <> 'just_me'`
--      condition is what makes switching an already-linked Moment to
--      just_me hide it automatically (the link row itself is never
--      touched — nothing to clean up).
--   4. space_moments(post_id) — no index covered a lookup by post_id
--      alone (the primary key is (space_id, post_id), post_id second);
--      rule 1's function does exactly that lookup on every posts read.
--
-- Safe to re-run: CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS + CREATE throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. private.post_shared_via_space() — see the header note above for why
--    this can't be inlined into the posts policy.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function private.post_shared_via_space(p_post_id bigint, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_moments sm
    join public.spaces s on s.id = sm.space_id
    where sm.post_id = p_post_id
      and sm.removed_by_host = false
      and s.status = 'active'
      and (
        (
          sm.status = 'approved'
          and (s.access = 'open' or public.is_space_member(s.id, p_viewer))
        )
        or (
          sm.status = 'pending'
          and public.is_space_host(s.id, p_viewer)
        )
      )
  );
$$;
revoke all on function private.post_shared_via_space(bigint, uuid) from public;
grant execute on function private.post_shared_via_space(bigint, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. "posts are readable by their audience".
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience"
  on public.posts for select
  using (
    (select auth.uid()) = user_id
    or (visibility = 'public' and is_visible_profile(user_id))
    or (
      visibility = 'followers'
      and (select auth.uid()) is not null
      and is_visible_profile(user_id)
      and exists (
        select 1 from public.profile_follows pf
        where pf.followed_id = posts.user_id
          and pf.follower_id = (select auth.uid())
          and pf.status = 'accepted'
      )
    )
    or (
      posts.visibility <> 'just_me'
      and is_visible_profile(posts.user_id)
      and private.post_shared_via_space(posts.id, (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. set_space_moment_status() — same body as the current live version
--    (20261005000000), plus the just_me rejection up front.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posting_mode text;
  v_author_id uuid;
  v_visibility text;
begin
  select posting_mode into v_posting_mode from spaces where id = new.space_id;
  select user_id, visibility into v_author_id, v_visibility from posts where id = new.post_id;

  if v_visibility = 'just_me' then
    raise exception 'Private Moments can''t be shared to a Space.';
  end if;

  if v_posting_mode = 'approval' and not public.is_space_host(new.space_id, v_author_id) then
    new.status := 'pending';
  else
    new.status := 'approved';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. space_moments(post_id) — supports rule 1's function.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists space_moments_post_idx on public.space_moments (post_id);
