-- NoSpace: correctness fixes.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run after sql/social.sql and sql/people.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Only the person who was asked can accept
--
--    The old policy allowed either party to update the row, so the SENDER
--    could set their own request to 'accepted' and unlock messaging without
--    the other person ever agreeing — which defeats the one rule the whole
--    messaging design rests on.
--
--    Now: the recipient answers (accept/decline), and that is the only way a
--    row becomes 'accepted'. The sender can still withdraw, which is a
--    delete, not an update.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "the recipient answers" on public.participations;
create policy "the recipient answers"
  on public.participations for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. A request must have someone on both ends, and they must differ
--
--    A row with no recipient could never be notified, accepted or withdrawn.
--    A row where sender and recipient match let someone hold a conversation
--    with themselves. Both are now rejected by the database, so no client
--    bug can reintroduce them.
--
--    join_in is exempt: joining an activity has no counterparty.
-- ─────────────────────────────────────────────────────────────────────────
delete from public.participations
where kind in ('make_together', 'explore_together')
  and (to_user is null or to_user = from_user);

alter table public.participations
  drop constraint if exists participations_need_a_counterparty;
alter table public.participations
  add constraint participations_need_a_counterparty
  check (
    kind = 'join_in'
    or (to_user is not null and to_user <> from_user)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Stop broadcasting unaddressed rows to everyone
--
--    The select policy included "or to_user is null", which made any
--    unaddressed row readable by every signed-in user. With the constraint
--    above there should be none left, but the policy shouldn't allow it.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "you see participations you are part of" on public.participations;
create policy "you see participations you are part of"
  on public.participations for select
  using (
    auth.uid() = from_user
    or auth.uid() = to_user
    -- Attendance of an activity is public: that's what "6 going" counts.
    or (kind = 'join_in' and to_user is null)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. One request per pair, per kind, while it's still pending
--
--    Tapping Send twice, or asking again while the first ask is unanswered,
--    used to create duplicate rows and duplicate notifications.
-- ─────────────────────────────────────────────────────────────────────────
create unique index if not exists participations_one_pending_ask
  on public.participations (from_user, to_user, kind)
  where status = 'pending' and kind in ('make_together', 'explore_together');
