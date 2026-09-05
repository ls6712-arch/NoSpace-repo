-- NoSpace: fix "Couldn't make that Space".
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run after connections.sql.
--
-- The bug: the row-level security policies on `spaces` and `space_members`
-- each queried the other table directly. Reading a Space evaluated the
-- membership policy, which read Spaces, which evaluated the Space policy…
-- Postgres detects this and refuses the query outright, so creating a Space
-- failed with an error the app reported as "Couldn't make that Space."
--
-- The fix is to route every cross-table check through SECURITY DEFINER
-- functions, which run with the definer's rights and so do not re-enter RLS.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Helpers that don't re-enter row-level security
-- ─────────────────────────────────────────────────────────────────────────

/** Does this person own that Space? */
create or replace function public.owns_space(s bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.spaces sp where sp.id = s and sp.owner = u);
$$;

/** Has this person joined that Space? */
create or replace function public.is_space_member(s bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = s and m.user_id = u and m.status = 'joined'
  );
$$;

/** Is this person in that Space at all — joined, or holding an invitation? */
create or replace function public.knows_space(s bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m where m.space_id = s and m.user_id = u
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Spaces — same rules, expressed without the loop
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "spaces are visible to members and by invitation" on public.spaces;
create policy "spaces are visible to members and by invitation"
  on public.spaces for select
  using (
    visibility = 'open'
    or owner = auth.uid()
    or public.knows_space(id, auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Membership — same rules, expressed without the loop
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "you see membership of spaces you are in" on public.space_members;
create policy "you see membership of spaces you are in"
  on public.space_members for select
  using (
    user_id = auth.uid()
    or public.is_space_member(space_id, auth.uid())
    or public.owns_space(space_id, auth.uid())
  );

drop policy if exists "members invite" on public.space_members;
create policy "members invite"
  on public.space_members for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or public.owns_space(space_id, auth.uid())
      -- The owner's own first membership row, written the moment the Space is
      -- created — at that point they are the owner but not yet a member.
      or user_id = auth.uid()
    )
  );

drop policy if exists "you can leave, the owner can remove" on public.space_members;
create policy "you can leave, the owner can remove"
  on public.space_members for delete
  using (user_id = auth.uid() or public.owns_space(space_id, auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Check it
--
--    Should return one row and no error. If this errors with "infinite
--    recursion detected in policy", something above didn't apply.
-- ─────────────────────────────────────────────────────────────────────────
-- select count(*) as spaces_readable from public.spaces;
