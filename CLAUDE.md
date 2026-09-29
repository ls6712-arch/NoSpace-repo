# Standing rules for this repo

These apply to every session working in this repo, not just Spaces-related work.

## Git / PRs

- **Never merge PRs.** Open them and tell the user; they merge.
- **Never edit a migration that has already run.** Fix forward with a new migration file — even for a one-line typo. `supabase/migrations/` is an append-only log of what's actually been applied; editing an already-run file makes the file lie about what's live.

## SQL

- In SQL policies and functions, **fully qualify every column inside subqueries** (`table.column`), even where it looks unambiguous. An unqualified column in a correlated subquery can silently bind to the wrong table when both tables in scope share that column name.
- **Every new DB feature ships with a verification script** (`supabase/verification/`), not just the migration:
  - One transaction, one `do $$ ... $$` block, ending unconditionally in `raise exception 'RESULTS: %', array_to_string(results, ', ');` so results land in the error message and the whole thing rolls back regardless of outcome.
  - Each expected *failure* case is its own `begin ... exception ... end` sub-block with strict `sqlstate` handling (e.g. `when raise_exception then ... when others then` record as an error, never silently treated as a pass).
  - Every count/assertion is scoped to the fixture's own ids, never a bare count against a whole live table.
- **Check the live schema with a query, not by trusting `docs/schema-baseline-*.sql` or similar snapshot files** — those may be stale relative to what's actually deployed. This session cannot run SQL against the live database itself: write the read-only query (e.g. against `information_schema` or `pg_catalog`) and give it to the user to run in the SQL editor, then wait for them to paste back the result before proceeding on anything that depends on it.

## Notifications

- Any **new notification kind** must be added to `enforce_notification_insert`'s allowed-kinds list, in a new migration (see the git rule above — that function has already run live, so it's always a new migration, never an edit to the one that defined it).
- **Notification bodies must stay under `enforce_notification_insert`'s 300-char cap.** When a body embeds a person's name or a title, truncate defensively: `left(name, 60)` for a person's name, `left(title, 150)`–`left(title, 200)` for a title, even if the source column's own constraint seems to already bound it — the cap is a trigger-level invariant that shouldn't depend on some other table's `CHECK` constraint never changing.

## Product terminology

- **Categories are never shown to users.** Corners are the only visible tags — Categories are an internal-only grouping now (used for admin/data organization), not something anyone picks or sees in the UI.
- **Say "Moments" in UI copy** — never "work" or "posts". A person's Moments are their Moments, not their "work" or their "posts", in any label, button, empty state, or message.
- **Spaces have no member counts anywhere in the UI.** Not on a Space card, not on the Space page header, not in a list — nowhere. If a number is needed, it's the Moments count (`space_moment_count_30d`), never a count of members.
