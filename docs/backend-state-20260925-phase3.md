# Backend state, checked 2026-09-25 — Communication Phase 3

Project: `eyzokuhhbyidvmuqfmwm`. Covers
`supabase/migrations/20261002000000_communication_phase3_unread.sql`,
applied live via `apply_migration` after Sush's explicit OK on the staged
migration/rollback/verification script (and one review fix to the migration
before applying — see below).

## What changed

1. `public.conversation_reads` — new table (`user_id`, `participation_id`,
   `last_read_at`, PK on the pair), RLS enabled, select/insert/update
   policies all requiring `auth.uid() = user_id` AND that the caller is a
   party to that `participation_id` and not blocked with the other side.
   No delete policy (default-deny).
2. `public.mark_conversation_read(pid bigint)` — `security invoker`,
   no-anon-execute. Rejects a caller who isn't a party to `pid` or whose
   thread isn't `accepted`; otherwise upserts `conversation_reads` with
   `last_read_at = greatest(existing, now())`.
3. `public.profile_settings.read_receipts boolean not null default true`.
4. `public.participation_message_summaries()` extended with an
   `unread_count` column — messages from the other party created after the
   caller's own `last_read_at` for that thread (or all of them, if never
   read). Had to `DROP FUNCTION` before recreating it, both here and in the
   rollback — Postgres won't let `CREATE OR REPLACE` change a set-returning
   function's output columns in place (`42P13`).
5. `private.other_party_seen_at(pid, other_user)` (`security definer`,
   `set search_path`) and `public.thread_seen_at(pid)` (`security invoker`).
   `thread_seen_at` checks everything visible to the caller under their own
   RLS (party to the thread, accepted, not blocked, their own
   `read_receipts` on) and, only if all of that holds, delegates to the
   `security definer` helper for the other party's `conversation_reads` row
   and `read_receipts` setting — the one place in the schema that reads
   another user's read-receipt data on purpose. Returns `null` uniformly
   for every "not allowed to know" case, so a caller can't distinguish
   "never read" from "not allowed to know."
6. `public.notifications` and `public.conversation_reads` added to the
   `supabase_realtime` publication (`messages`/`participations` were
   already there from Phase 2).

### Review fix before applying

Sush caught this before anything went live: `thread_seen_at` is `SECURITY
INVOKER`, so it runs as the calling role — including the nested call into
`private.other_party_seen_at`. The first draft of the migration revoked
that helper's execute grant from `authenticated` along with `public`/`anon`,
which meant every real call would fail with "permission denied for function
other_party_seen_at" and Seen would never work. Fixed by granting execute
on `private.other_party_seen_at(bigint, uuid)` to `authenticated` (still
revoked from `public`/`anon`) — the `private` schema isn't exposed through
the API, so it stays reachable only via `thread_seen_at`, the same pattern
already in use for `private.is_blocked_between`. The rollback and
verification script were both updated to match before applying.

## Verification

`supabase/verification/communication_phase3_check.sql` run live, entirely
inside a transaction that ends in `ROLLBACK` (same impersonation pattern as
Phases 1 and 2 — `set_config('role', 'authenticated', true)` genuinely
changes the effective role for permission checks, which is what makes this
script capable of catching a grant bug like the one above rather than
silently running everything as the `postgres` superuser). All properties
held on the final run:

```
RESULTS: pending_mark_rejected=t seen_pending_is_null=t unread_before=2 unread_after=0
seen_before_read_is_null=t seen_after_read_is_not_null=t seen_other_receipts_off_is_null=t
seen_my_receipts_off_is_null=t cannot_select_others_row=t cannot_insert_others_row=t
cannot_update_others_row=t bystander_mark_rejected=t seen_blocked_despite_prior_read_is_null=t
publication_tables={conversation_reads,messages,notifications,participations}
```

One fixture correction made mid-verification: the script's first draft
tested "still pending" behavior on a Sush↔Sushmitha thread, assuming it
would stay pending like the analogous fixture in Phase 2's script did. Live
queries showed that pair already mutually follows each other, and a
pre-existing trigger (`set_participation_insert_status()`) auto-accepts a
new `direct_message` immediately when the recipient already follows the
sender — so that thread was actually `accepted`, and both "still pending"
assertions correctly failed against it (the function was right; the
fixture's assumed status was wrong). Fixed by exercising both the
pending-phase and accepted-phase behaviors sequentially on the same
Sush↔spd0008 thread, which genuinely starts pending.

## Security advisors

Run immediately after applying. No new findings attributable to this
migration. One pre-existing-pattern note worth recording rather than acting
on unreviewed: the performance advisor flags `conversation_reads.participation_id`'s
foreign key as lacking a covering index beyond the table's primary key —
minor, non-blocking, and left alone since it wasn't part of the
reviewed/approved migration.
