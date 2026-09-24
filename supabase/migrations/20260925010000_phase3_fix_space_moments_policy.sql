-- Sushii: Spaces Rework Phase 3 — fix a real bug found by actually running
-- 20260925000000_spaces_rework_phase3_membership.sql's own verification
-- script (checks 7, 19, 21 failed).
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260925000000_spaces_rework_phase3_membership.sql.
--
-- Root cause: "space moments follow the space's access" (the space_moments
-- SELECT policy) correlates against `spaces` inside an EXISTS subquery,
-- and both tables have a column named `status`. Two of the three
-- references inside that subquery were unqualified:
--
--   select 1 from spaces s
--   where s.id = space_id
--     and s.status = 'active'
--     and (
--       (status = 'approved' and (s.access = 'open' or is_space_member(s.id, auth.uid())))
--       or (status = 'pending' and (...))
--     )
--
-- The bare `status` inside that subquery doesn't fall through to the
-- outer space_moments row the way `space_id`/`post_id` safely do
-- elsewhere in this same policy (spaces has no column named space_id or
-- post_id, so those two really are unambiguous) — spaces DOES have its
-- own status column, so the bare reference bound to spaces.status
-- instead, silently. Since s.status = 'active' was already required two
-- lines up, `status = 'approved'` collapsed to `'active' = 'approved'`
-- (always false) and `status = 'pending'` to `'active' = 'pending'`
-- (also always false) — so neither branch of the OR could ever be true,
-- for anyone: the policy denied every space_moments row to every caller,
-- including its own owner and every Space's hosts.
--
-- That's why checks 7, 19, and 21 (the only checks in the verification
-- script that expected to actually SEE a Moment — everything else
-- expected 0 rows and got 0 rows regardless, passing vacuously) were the
-- only ones that failed: they're the only checks this bug could have
-- shown up in at all.
--
-- Fix: qualify every space_moments-owned column in this policy with the
-- table name, not just the two that happened to be safe by omission on
-- `spaces`. Already applied directly against production by the user who
-- found this (confirmed via the same verification script, all three
-- checks now pass) — this migration brings the repo's migration history
-- back in sync with what's actually live, and is what anyone rebuilding
-- the schema from scratch will now get.
--
-- Safe to re-run: DROP POLICY IF EXISTS, then CREATE.

drop policy if exists "space moments follow the space's access" on public.space_moments;
create policy "space moments follow the space's access"
  on public.space_moments for select
  using (
    space_moments.removed_by_host = false
    and exists (
      select 1 from spaces s
      where s.id = space_moments.space_id
        and s.status = 'active'
        and (
          (space_moments.status = 'approved' and (s.access = 'open' or public.is_space_member(s.id, auth.uid())))
          or (
            space_moments.status = 'pending'
            and (
              public.is_space_host(s.id, auth.uid())
              or exists (select 1 from posts p where p.id = space_moments.post_id and p.user_id = auth.uid())
            )
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select qual from pg_policies
-- where tablename = 'space_moments' and policyname = 'space moments follow the space''s access';
-- -- eyeball it: every space_moments column should read "space_moments.<col>",
-- -- not bare.
--
-- Then re-run supabase/verification/phase3_membership_access_check.sql in
-- full — checks 7, 19, and 21 (previously FAIL) should now read PASS, and
-- nothing else in the RESULTS line should have changed.
