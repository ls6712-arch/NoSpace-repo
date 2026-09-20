-- Pause: write-side check. A revoked session (see
-- docs/pause-session-revocation-plan.md) still holds a valid access token
-- until that token's own expiry — signOut only stops a NEW token from
-- being minted. This closes that gap at the database itself: a paused
-- account's own INSERT/UPDATE on posts or pursuits is rejected regardless
-- of whether its access token is still technically valid. Draft only, for
-- review — not applied.
--
-- Deliberately scoped to `paused_at` only, not `deletion_requested_at` —
-- that's a separate, larger decision (should a pending-deletion account be
-- able to keep editing during its grace period?) I'm not making here.
--
-- Along the way, posts and pursuits turn out to each have the same
-- multiple-overlapping-policy pattern migration (b) fixed for SELECT: two
-- INSERT policies and two UPDATE policies per table, functionally
-- identical to each other. Consolidating each pair into one, same as (b)
-- did, rather than adding a third redundant policy on top of two existing
-- ones.

create or replace function public.write_blocked_by_pause()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.paused_at is not null
  );
$$;

drop policy if exists "You can post as yourself" on public.posts;
drop policy if exists "you post your own moments" on public.posts;
create policy "you post your own moments"
  on public.posts for insert
  with check (
    (select auth.uid()) = user_id
    and not public.write_blocked_by_pause()
  );

drop policy if exists "You can edit or delete your own posts" on public.posts;
drop policy if exists "own posts are editable" on public.posts;
create policy "own posts are editable"
  on public.posts for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and not public.write_blocked_by_pause()
  );

drop policy if exists "you can start a pursuit" on public.pursuits;
drop policy if exists "you create your own pursuits" on public.pursuits;
create policy "you create your own pursuits"
  on public.pursuits for insert
  with check (
    (select auth.uid()) = user_id
    and not public.write_blocked_by_pause()
  );

drop policy if exists "you can update your own pursuit" on public.pursuits;
drop policy if exists "you edit your own pursuits" on public.pursuits;
create policy "you edit your own pursuits"
  on public.pursuits for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and not public.write_blocked_by_pause()
  );
