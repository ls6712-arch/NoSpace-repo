# Communication Phase 1 — post-merge fix verification

Four bugs were found testing PR #96 live: a "Message" tap created an empty
participation row immediately (before any message), so the composer started
disabled and a `message_request` notification never had anything to fire on;
the composer's enabled/disabled rule didn't account for message count; a
newly created thread could flash "No open threads" before settling; and the
empty-conversation copy could render an empty quoted intent. Fixed by never
creating a participation row without its first message riding along in the
same call (`SocialContext.tsx`'s `startAndSendDirectMessage`), a `canSendInto`
rule in `messageTabs.ts` that accounts for message count, and per-kind
empty-state/subtitle copy in `Messages.tsx` (`emptyStateFor`/`subtitleFor`).

## Live verification

The database side of the fix (insert-participation-with-its-first-message,
exactly one `message_request` notification, the unique-DM-per-pair reuse
rule, the composer unlocking on accept) was verified against the **real
production database**, impersonating two real accounts with zero prior
history between them (Sush → spd0008 — confirmed via `profile_follows` and
`participations` that neither follows the other and no thread exists),
inside a transaction that was rolled back afterward so nothing persisted.
All 9 checks passed:

```
pid=86 initial_status=pending msg_count_before_accept=1 dup_insert_rejected=t
b_can_select_pending=t b_notif_count=1 b_notif_kind=message_request
b_notif_actor_is_a=t final_status=accepted final_msg_count=2
```

A literal "browser logs into the real app as a real account" session was not
possible from this environment: its egress policy blocks all outbound
network to `supabase.co` for both `curl` and the browser (confirmed via the
proxy's own diagnostics — "destination host not allowed by your
organization's egress policy... do not route around it"), independent of
credentials. So the actual React UI states below were verified with a real
Chromium browser running the real rebuilt app code, with the Supabase
REST/auth API mocked (no real network reachable regardless).

## Screenshots

| File | Shows |
| --- | --- |
| `01-draft-then-locked-after-send.png` | The same conversation before and after the fix: an enabled, empty draft with no row created yet, then locked with "Waiting for Rowan Ashford to accept." after the one message sends |
| `02-empty-intent-fallback-copy.png` | An accepted Make-together thread with no intent set — falls back to "Say hi to Sam Patel." and a plain "Making together" subtitle, never an empty quote or "undefined" |
| `03-zero-message-request-hidden.png` | Message requests correctly showing empty — a zero-message pending row never surfaces as something to accept or ignore |
