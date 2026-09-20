# Ticket: RLS performance cleanup (auth_rls_initplan, multiple_permissive_policies)

**Status:** parked, not scheduled. Found during the 2026-09-20 advisor audit
(see `docs/backend-state-20260920.md`). Not a correctness or security bug —
both are pre-existing, schema-wide patterns, not introduced or missed by the
pause/deletion privacy workstream. Do not start this without explicit
go-ahead.

## 1. `auth_rls_initplan` — 61 findings

Most RLS policies elsewhere in the schema call `auth.uid()` (or another
`auth.*` function) unwrapped, so Postgres re-evaluates it per row instead of
once per query. Fix is mechanical: wrap each call as `(select auth.uid())`,
the same pattern already used in every policy this workstream touched
(`posts`, `pursuits`, `thoughts` INSERT/UPDATE; the `is_visible_profile`-based
SELECT policies from migrations (b)/(b2)).

Affected tables and policy counts:

| table | policies |
|---|---|
| category_suggestions | 4 |
| circle_members | 3 |
| circles | 3 |
| connections | 4 |
| corners | 2 |
| hobby_follows | 1 |
| messages | 4 |
| moment_drafts | 4 |
| notifications | 2 |
| participations | 4 |
| post_likes | 1 |
| posts | 2 (the untouched DELETE pair) |
| private_logs | 4 |
| profile_follows | 3 |
| profile_links | 3 |
| profile_settings | 3 |
| profiles | 2 |
| pursuits | 2 (the untouched DELETE pair) |
| space_members | 4 |
| spaces | 4 |
| categories | 1 |
| thoughts | 1 |

## 2. `multiple_permissive_policies` — 28 findings

Duplicate-permissive-policy pattern — the same one migration (b) already
consolidated for SELECT on `posts`/`pursuits`/`profiles` — still present on
other command/table/role combinations:

| table | action | policies |
|---|---|---|
| posts | DELETE | "You can delete your own posts", "you delete your own moments" |
| pursuits | DELETE | "you can delete your own pursuit", "you delete your own pursuits" |
| categories | SELECT | "categories are readable by anyone", "reviewers manage categories" |
| corners | INSERT | "anyone signed in can create a corner", "space members can create a corner" |
| hobby_follows | SELECT | "hobby follows are readable", "you manage your own hobby follows" |
| messages | SELECT | "messages need an accepted participation", "you read messages meant for you" |
| messages | INSERT | "you can write in an accepted thread", "you write to connections and your spaces" |
| post_likes | SELECT | "post likes are readable", "you manage your own likes" |

`posts` DELETE and `pursuits` DELETE were deliberately left alone by the
`pause_write_checks` migration (that migration only touched INSERT/UPDATE)
— confirmed still duplicated as of the 2026-09-20 live policy dump.

## Proposed fix, when scheduled

Same approach as migration (b): for each table/action pair above, drop both
existing policies and create one consolidated policy combining their
conditions with `OR`, wrapping every `auth.*` call as `(select auth.*())`.
Draft as its own migration + rollback, test with the two-throwaway-account
harness, do not apply without explicit go-ahead — same process as the rest
of this workstream.
