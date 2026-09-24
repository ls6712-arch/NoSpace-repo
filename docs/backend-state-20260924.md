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

`20260924100000_post_reaction_counts.sql` (public `love_count`/`in_count` on `posts`) — **not applied**. Confirmed: neither column exists on `posts` yet. Staged, per the patch's own note, until reviewed and approved — see the PR for the review point.

## Also not in `list_migrations` (not part of this task, not verified)

`20260923000000_widen_participations_kind_for_dm.sql` is tracked in the repo but the migration-history gap above covers it too. Not checked against live objects (`participations`/`corners` tables both exist, but the specific `kind` widening wasn't verified) — out of scope for this task; flagging only so it isn't mistaken for confirmed-applied.
