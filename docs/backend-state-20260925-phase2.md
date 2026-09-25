# Backend state, checked 2026-09-25 — Communication Phase 2

Project: `eyzokuhhbyidvmuqfmwm`. Covers `supabase/migrations/20261001010000_communication_phase2_live.sql`,
applied live via `apply_migration` after Sush's explicit OK on the staged
migration/rollback/verification script.

## What changed

1. `public.messages` and `public.participations` added to the
   `supabase_realtime` publication (it published zero tables before this).
   Both tables' existing RLS still governs what each subscriber receives —
   confirmed in the verification script below and by Supabase's own
   documented behavior for supabase-js ^2.116's Postgres Changes.
2. `public.participation_message_summaries()` — a new `security invoker`,
   `set search_path`, no-anon-execute function returning one row per
   thread (message count + latest message) for the calling user's own
   participations. Feeds the conversation list preview without loading
   every thread's full history.

## Verification

`supabase/verification/communication_phase2_check.sql` run live, entirely
inside a transaction that ends in `ROLLBACK` (impersonation pattern, same
as Phase 1's own script) — all four properties held:

- The summary function returns the correct count/last message for an
  accepted thread, and a real bystander account sees nothing for it.
- Blocking mid-conversation removes the thread from the summary for
  **both** sides, not just zeroing it out.
- A declined direct_message's recipient gets no preview (zero count, null
  last-message fields); its sender still sees their own message.
- The publication contains exactly `{messages, participations}`.

One correction made mid-verification, folded into the script before the
final passing run (not left as a separate follow-up): the script's first
draft assumed a `participations` row could be inserted directly with
`status = 'accepted'`. Live behavior (a Phase 1 safeguard) forces every new
row to `pending` regardless of what's passed — the accepted-thread fixtures
now go through the real accept flow (the recipient updates status), which
is what actually exercises the intended path anyway.

## Security advisors

Run immediately after applying. No new findings attributable to this
migration — `participation_message_summaries()` doesn't appear in either
the `SECURITY DEFINER`-executable-by-anon/authenticated lints (it isn't
`SECURITY DEFINER`) or anywhere else. Every finding reported (Spaces'
existing `SECURITY DEFINER` RPCs, a handful of `archive.*` tables with RLS
enabled and no policies, `public.rate_limit_hits` likewise, one function
missing `search_path`, and leaked-password-protection being off) predates
this change and belongs to other, unrelated parts of the schema.
