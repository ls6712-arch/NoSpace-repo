-- Stubby plan PR 3: the deck, follow-ups and the bring-a-friend nudge (docs/briefs/stubby-plan.md §6.5, §10.1).
--
--   stubby_asks.free_follow_up_used   The first follow-up after an ask (Cheaper, Later...) is free
--                                     (§10.1, decided Nov 1, 2026). The function marks it used on the
--                                     ask itself, in one update that only succeeds once, so a free
--                                     follow-up never adds a row and never counts toward 3 a day.
--   personal_picks.better_with_friend The model marked this pick better with a friend (solo asks only,
--                                     at most one per set), for the nudge.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261108000000_stubby_deck.sql.

alter table public.stubby_asks
  add column free_follow_up_used boolean not null default false;

alter table public.personal_picks
  add column better_with_friend boolean not null default false;
