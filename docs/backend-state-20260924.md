# Backend state, checked 2026-09-24

Project: `eyzokuhhbyidvmuqfmwm` (ls6712@stern.nyu.edu's Project). Checked directly against the live schema via Supabase MCP tools while working on `feat/even-moment-cards`.

## A tracked-migration gap worth knowing about

`list_migrations` (the project's own applied-migration history) stops at `20260922035348_backfill_written_post_type`. Everything dated 2026-09-23 or later — five files, `supabase/migrations/20260923000000_widen_participations_kind_for_dm.sql` through `20260923130000_pursuit_notification_plurals.sql` — is **absent from that history**, even though four of them are actually live (checked below). These five are written "Supabase → SQL Editor → New query → paste → Run" style, not run through the tracked `apply_migration` tool, so pasting them straight into the dashboard leaves no entry in `list_migrations` even after they've executed. **Don't trust `list_migrations` alone for anything dated 2026-09-23 or later — check the actual objects.**

## The four Pursuit migrations named in this task

All four are **already live**, confirmed by inspecting the actual columns/tables/function body rather than the migration history:

| Migration | Status | Checked |
|---|---|---|
| `20260923100000_pursuit_rest_and_checkins` | ✅ Applied | `pursuits.paused_at`, `.check_in_days`, `.ending_note` all exist |
| `20260923110000_pursuits_measured_and_shared` | ✅ Applied | `pursuits.mode`, `.measure`, `pursuit_members`, `pursuit_progress` all exist |
| `20260923120000_pursuit_invite_links_and_notifications` | ✅ Applied | `pursuit_invite_links` table exists |
| `20260923130000_pursuit_notification_plurals` | ✅ Applied | `notify_pursuit_progress()`'s live body already has the singular-unit logic (checked `pg_proc.prosrc` directly) |

Nothing to apply here — just flagging that `list_migrations` under-reports, in case a future session sees the missing history and assumes otherwise.

## This task's own migration

`20260924200000_post_reaction_counts.sql` (public `love_count`/`in_count` on `posts`) — **applied Sept 24, 2026, ~5 PM ET** (recorded on live as `post_reaction_counts`). Verified: all 33 posts' counts match `count(*)` on `reactions` (3 Love, 0 Count me in); trigger `reactions_sync_counts` present; `anon`/`authenticated` cannot execute `sync_post_reaction_counts()`; a rolled-back insert/delete test moved `in_count` 0 → 1 → 0.

## Also not in `list_migrations` (not part of this task, not verified)

`20260923000000_widen_participations_kind_for_dm.sql` is tracked in the repo but the migration-history gap above covers it too. Not checked against live objects (`participations`/`corners` tables both exist, but the specific `kind` widening wasn't verified) — out of scope for this task; flagging only so it isn't mistaken for confirmed-applied.

## Communication Phase 1 (Safety) — applied

`supabase/migrations/20260925020000_communication_phase1_safety.sql` — **applied to live Supabase 2026-09-24**, via `apply_migration` (so, unlike the gap above, this one *is* in `list_migrations`), in four passes: the main file, then three small in-place fixes for bugs the verification script itself caught mid-run against live data (all now folded into the tracked migration file itself, not left as separate follow-up files, since nothing had shipped to users yet):

1. `messages`' own INSERT policy hit Postgres's RLS self-recursion guard (`42P17: infinite recursion detected in policy for relation "messages"`) on every insert — its pending-thread branch checked `not exists (select 1 from public.messages m2 where m2.participation_id = p.id)`, and Postgres treats *any* subquery against a table from within that table's own policy as potential recursion, even one that terminates. Fixed via a new `SECURITY DEFINER` helper, `private.participation_has_message(pid)`, which bypasses RLS on its internal query.
2. A blocked person could still react to and comment on the blocker's Moment. The reactions/thoughts INSERT policies resolved the Moment's owner via a plain `select user_id from posts where id = ...` — a subquery subject to the *caller's own* RLS on `posts`. Once the block hid that post from the blocked person (via `is_visible_profile`, part of this same migration), the subquery returned zero rows (`NULL`), and `not is_blocked_between(x, null)` evaluated to `true` — silently defeating the very check meant to stop the reaction. Fixed via a new `SECURITY DEFINER` helper, `private.post_owner(pid)`, which always resolves the true owner regardless of visibility.
3. Hygiene: revoked direct `EXECUTE` (anon/authenticated) on the six new trigger functions, per the security advisors. Not actually exploitable either way — every one is `RETURNS TRIGGER`, and Postgres refuses to invoke those outside trigger context regardless of grants (confirmed live) — but free to close, and it quiets the advisor for what this phase specifically added.

**Verification**: `supabase/verification/communication_phase1_check.sql` run live after all fixes — all 56 checks `PASS` (block enforcement both directions on messages/participations/follows/reactions/thoughts/reads; message-request lifecycle including the pending→declined→re-accepted path; the `make_together`/`explore_together` forced-`pending` fix; the withdraw-then-resend fix; notifications hardening — kind allowlist, href pattern, actor_id/actor_name spoofing, blocked-actor silent drop; reports visibility/admin-review; the `is_blocked_between` schema-relocation check; the one-DM-per-pair unique index). Entirely inside a transaction that ends in `ROLLBACK` — nothing persisted.

One thing the verification run surfaced that is *not* a bug: two of the three real test accounts' `profiles.is_admin` flags had changed live, in opposite directions, between this migration being drafted and the script first being run (most likely real concurrent use of the app, unrelated to this work) — this briefly looked like a reports-RLS failure until traced to live data drift, not the migration. The verification script now forces both accounts' admin status inside its own rolled-back transaction rather than assuming live state, so this can't recur.

**Security advisors, post-apply**: no new findings beyond the six trigger-function RPC-exposure ones already fixed above (see point 3). Everything else the advisors report (~55 more `SECURITY DEFINER`/anon findings, one mutable-search-path function, empty-policy RLS tables in `archive`/`rate_limit_hits`, leaked-password protection) is pre-existing, unrelated to this migration, and tracked separately — see `docs/communication-strategy.md`'s follow-up to audit live against `sql/security-hardening.sql`.

Part B (the app) shipped in PR #96, with fixes in PRs #98 and #102.

## Reports: one open report per target — applied 2026-09-25

`supabase/migrations/20260925050000_reports_one_open_per_target.sql` — **applied to live
2026-09-25** (recorded as `reports_one_open_per_target`), after the two duplicate open reports
(ids 8 and 9) were marked reviewed/dismissed by an admin. Verified live in a rolled-back
transaction: a first open report inserts, an identical second one is rejected
(`unique_violation`, which the app shows as "Report sent"), and a new report is allowed again
once the earlier one is no longer open.
