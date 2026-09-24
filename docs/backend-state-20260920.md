# Current backend state — 2026-09-20

Project `eyzokuhhbyidvmuqfmwm`. Snapshot after the pause/deletion privacy
hardening work this session; update this note (or add a new dated one)
next time the schema changes materially.

## Applied migrations (this workstream)

All seven, in order, matching `supabase/migrations/` by name:

| name | applied version | file |
|---|---|---|
| pause_deletion_foundation | 20260919230028 | `20260919230000_pause_deletion_foundation.sql` |
| consolidate_visibility_policies | 20260920115108 | `20260919230100_consolidate_visibility_policies.sql` |
| pause_visibility_b2 | 20260920115352 | `20260919231000_pause_visibility_b2.sql` |
| posts_visibility_private | 20260920115607 | `20260919230200_posts_visibility_private.sql` |
| reactions_and_bookmarks | 20260920115821 | `20260919230300_reactions_and_bookmarks.sql` |
| close_post_media_listing | 20260920120120 | `20260919232000_close_post_media_listing.sql` |
| pause_write_checks | 20260920174056 | `20260920000000_pause_write_checks.sql` |

Filename timestamps don't match applied version timestamps — `apply_migration`
generates its own version at call time. The `name` field is what actually
corresponds between the repo and `list_migrations`, and all seven match.

Storage hardening (public-read removed from `storage.objects` post-media
SELECT) shipped as part of `close_post_media_listing`.

Pre-existing gap, not from this workstream: 17 older migrations (everything
before `pause_deletion_foundation`, e.g. `create_private_logs`,
`profile_onboarding`, `post_likes`, `open_tags`, ...) exist in the database's
own migration history but have no corresponding file in this repo — the
`supabase/migrations/` convention started with this session. `private_logs`
is the one exception, documented at `docs/private_logs_schema.sql` for
repo parity.

## Drafts — not applied, no go-ahead given

- **`supabase/migrations/20260920000100_pause_storage_upload_check.sql`** —
  post-media upload blocking while paused/deletion-pending, extending
  `write_blocked()` to `storage.objects` INSERT. Left as commented-out SQL
  only, per instruction not to draft it further. Also has an open question
  baked into its own comments: should an upload already in progress when
  `paused_at` is set be allowed to finish, or blocked instantly?
- **`circle_invites` / `shared_milestones` / `is_admin` drift** — flagged
  earlier in this workstream as a separate follow-up, not yet drafted.
- **Private media bucket** — `docs/private-media-plan.md` has the plan;
  explicitly not to be built yet.

## Backup

`backup_20260919` (schema, holds copies of `profiles`, `posts`, `pursuits`,
`connections` from immediately before this workstream's migrations) —
**drop by 2026-10-20** after verification. Full detail in
`docs/backup-20260919-retention.md`.

## Advisor findings, 2026-09-20

Full findings pasted in chat the same day this file was written. Summary of
what's open at WARN level or above:

**Security:**
- `reject_test_display_names` has a mutable search_path (pre-existing, not
  from this workstream).
- 5 `SECURITY DEFINER` functions callable by `anon`, 11 by `authenticated`
  (includes `write_blocked()`, intentional) — worth a pass to confirm which
  are meant to be public vs. need tighter grants, especially the `admin_*`
  functions.
- Leaked password protection is disabled in Auth settings (dashboard
  toggle, not a migration).

**Performance:**
- `auth_rls_initplan` (61 findings) — most existing policies across the
  schema call `auth.uid()` unwrapped instead of `(select auth.uid())`, so
  it re-evaluates per row. This workstream's own new/edited policies
  already use the wrapped form; the remaining 61 are pre-existing policies
  on tables largely untouched by this workstream (`profiles`, `spaces`,
  `connections`, `messages`, `participations`, `moment_drafts`, etc.).
- `multiple_permissive_policies` (28 findings) — duplicate-policy pattern
  like the one migration (b) fixed for SELECT, still present on other
  command/table/role combinations: `posts` DELETE, `pursuits` DELETE
  (deliberately left alone by the write-checks migration), plus
  pre-existing duplicates on `categories`, `corners`, `hobby_follows`,
  `messages`, `post_likes`.

Neither performance category is a correctness bug — both are pre-existing,
schema-wide patterns, not something introduced or missed by this
workstream's migrations. Fixing them at scale would be its own follow-up.
