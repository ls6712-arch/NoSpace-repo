-- Step 5a · Next session, times a week, and Let go
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261013000000_step4c_invites_and_day2_ask.sql.
--
-- 1. pursuit_plans — one row per (Pursuit, person): when their next
--    session is, an optional note for it, and how many times a week they
--    aim for. Owner-only in every direction: a shared Pursuit is readable
--    by anyone (see "owners, members and the public (if shared) see a
--    pursuit"), and a plan is personal, so it lives in its own table rather
--    than as columns on pursuits. In a shared Pursuit, each person keeps
--    their own plan.
-- 2. pursuits.let_go_at — "Let go": stopping without finishing. A fourth
--    state beside active, Resting and Completed. Lives on pursuits like
--    paused_at, so whoever can see the Pursuit sees its state.
--
-- Every column inside every subquery is fully qualified.
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. pursuit_plans
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.pursuit_plans (
  pursuit_id text not null references public.pursuits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  next_session_at timestamptz,
  next_session_note text check (next_session_note is null or char_length(next_session_note) <= 140),
  times_per_week smallint check (times_per_week is null or times_per_week between 1 and 14),
  updated_at timestamptz not null default now(),
  primary key (pursuit_id, user_id)
);
create index if not exists pursuit_plans_user_idx on public.pursuit_plans (user_id);

alter table public.pursuit_plans enable row level security;

drop policy if exists "you see your own plans" on public.pursuit_plans;
create policy "you see your own plans"
  on public.pursuit_plans for select to authenticated
  using ((select auth.uid()) = public.pursuit_plans.user_id);

-- Only for a Pursuit you own or take part in, and only as an active,
-- unblocked account — same gates the pursuits table's own writes use.
drop policy if exists "you plan your own pursuits" on public.pursuit_plans;
create policy "you plan your own pursuits"
  on public.pursuit_plans for insert to authenticated
  with check (
    (select auth.uid()) = public.pursuit_plans.user_id
    and private.is_active((select auth.uid()))
    and not (select public.write_blocked())
    and (
      exists (
        select 1 from public.pursuits
        where public.pursuits.id = public.pursuit_plans.pursuit_id
          and public.pursuits.user_id = (select auth.uid())
      )
      or public.is_pursuit_participant(public.pursuit_plans.pursuit_id, (select auth.uid()))
    )
  );

drop policy if exists "you edit your own plans" on public.pursuit_plans;
create policy "you edit your own plans"
  on public.pursuit_plans for update to authenticated
  using ((select auth.uid()) = public.pursuit_plans.user_id)
  with check (
    (select auth.uid()) = public.pursuit_plans.user_id
    and not (select public.write_blocked())
  );

drop policy if exists "you delete your own plans" on public.pursuit_plans;
create policy "you delete your own plans"
  on public.pursuit_plans for delete to authenticated
  using ((select auth.uid()) = public.pursuit_plans.user_id);

revoke all on public.pursuit_plans from anon;
grant select, insert, update, delete on public.pursuit_plans to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. pursuits.let_go_at
-- ─────────────────────────────────────────────────────────────────────────
alter table public.pursuits add column if not exists let_go_at timestamptz;
