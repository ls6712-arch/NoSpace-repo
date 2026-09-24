-- Rollback for 20260925010000_phase3_fix_space_moments_policy.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the exact pre-fix policy text — the one with the unqualified
-- `status` bug that made every space_moments row unreadable by anyone.
-- This is a rollback in the literal sense (undo this migration, go back
-- to what came immediately before it), not a recommendation: running it
-- reintroduces a real bug that was found and fixed by actually running
-- this phase's own verification script against production. There is no
-- legitimate reason to run this outside of historical reference.

drop policy if exists "space moments follow the space's access" on public.space_moments;
create policy "space moments follow the space's access"
  on public.space_moments for select
  using (
    removed_by_host = false
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (
          (status = 'approved' and (s.access = 'open' or public.is_space_member(s.id, auth.uid())))
          or (
            status = 'pending'
            and (
              public.is_space_host(s.id, auth.uid())
              or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
            )
          )
        )
    )
  );
