# Communication Phase 1 — block/report follow-up fixes

Live testing confirmed block/report/unblock work end to end. Two bugs found along the way:

## 1. Blocked party sees a ghost thread

While Nani had blocked Sushmitha, Sushmitha's Chats showed participation 90 as "Someone"
with an empty thread and an enabled composer — RLS correctly hid Nani's profile and messages,
but the app still rendered a thread for it.

Fixed with `messageTabs.ts`'s new `hasVisibleOtherParty()`: a participation is dropped
whenever its other party's profile id isn't among the ones that actually came back from the
profiles fetch. Wired in at the single point every read goes through —
`SocialContext.tsx`'s `refresh()` filters `state.participations` before it's ever set, so the
conversation list, `?thread=` deep links, and the composer all inherit the fix for free; there
was nothing left to render, so nothing reveals that a block (rather than a deleted or paused
account) is the reason.

**Live verification** (real accounts, rolled back): as Sushmitha, a plain `select` on Nani's
`profiles` row returns one row normally, zero rows the moment Nani blocks her, and one row
again after unblocking —

```
visible_before=t visible_while_blocked=f visible_after_unblock=t
```

— confirming the exact mechanism `hasVisibleOtherParty()` relies on. Nothing persisted (the
block insert/delete ran inside a transaction that was rolled back).

## 2. Reports are double-submitted

Reports 8 and 9 are identical (Nani → Sushmitha, profile, 'other', 43 seconds apart) — a fast
double-click fired the insert twice before React re-rendered with the button disabled.

Fixed two ways:
- **App side**: `ReportDialog.tsx` now guards `submit()` with a plain `useRef`, checked and set
  synchronously before any state update or `await` — a state-based `disabled` alone isn't
  enough, since the browser can dispatch a second click before the first render lands. The
  dialog also now closes on its own ~1.4s after showing "Report sent." (a manual Close button
  still works immediately for anyone who doesn't want to wait).
- **Database side** (staged, not yet applied — see
  `supabase/migrations/20260925050000_reports_one_open_per_target.sql` and its rollback): a
  unique partial index so one reporter can have only one **open** report per
  `(target_kind, target_user_id, coalesce(target_id, 0))`. `SocialContext.tsx`'s `report()`
  now treats that index's `23505` (unique_violation) as success rather than a failure — the
  reporter already has an open report on this exact target, so "Report sent. Thanks for
  telling us." is the honest response, not a retry-inviting error.

**Reports 8 and 9 are left alone**, per instruction. This means the migration as staged will
fail if applied right now: confirmed live in a dry run (created the same index under a
different name inside a rolled-back transaction) —

```
ERROR: 23505: could not create unique index "reports_one_open_per_target_dryrun"
DETAIL: Key (reporter_id, target_kind, target_user_id, COALESCE(target_id, 0::bigint))
        =(2410e037-…, profile, 87220a04-…, 0) is duplicated.
```

— and confirmed reports 8/9 are the *only* duplicate pair currently in the table. Before
applying the staged migration, one of the two needs to move out of `status = 'open'` (e.g.
Mark reviewed or Dismiss from the admin Reports page) — this migration doesn't do that itself.

## Screenshots (mocked-network browser pass)

This sandbox's egress policy blocks all outbound traffic to `supabase.co` for both `curl` and
the browser, so these exercise the real rebuilt app code with the Supabase REST/auth API
mocked, same as the rest of this phase's UI verification.

| File | Shows |
| --- | --- |
| `01-ghost-thread-excluded.png` | Only the one resolvable thread (Sam Patel) is listed; the hidden one (participation 90, Nani) never appears, and a `?thread=90` deep link doesn't resurrect it or render a composer |
| `02-double-click-single-report.png` | "Report sent" after firing two near-simultaneous clicks on Send report — exactly one insert reached the server |
| `03-conflict-still-shows-sent.png` | A mocked `23505` response from the reports insert still shows "Report sent. Thanks for telling us.", never the generic failure message |
