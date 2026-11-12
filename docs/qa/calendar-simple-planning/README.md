# Simpler Calendar planning and usual free times

The plan form uses a Corner search and two visible date/time fields. Selecting a calendar slot preserves that exact time. Changing the day keeps the time; there is no Daytime/Evening toggle to clear it. The title stays Make a plan instead of repeating an outdated time. Bring someone reveals the optional friend picker. Empty Corner choices have initial suggestions, changing the search clears the previous selection, and selected Corners do not show a false no-match message. Empty, past and nonexistent daylight-saving times cannot be submitted.

The empty-time menu retains its three separate actions: make a plan, declare free time, or block time. Its plan button no longer repeats the time already in the heading.

The usual-free-times editor uses exact local hours for each weekday. Each day supports multiple ranges and shows a summary when collapsed. Copy to other days opens a short sheet with the destination days; copying adds and merges hours instead of deleting existing hours. Overlapping ranges cannot be saved. Midnight as the end means the end of that day; longer overnight availability is entered on the two respective days. The editor accepts up to eight ranges per day. Clear usual free times is an explicit action, followed by Save.

Saved choices must load successfully before editing or saving. Read failures show Retry, failed saves retain edits, and account changes discard late responses. Earlier broad selections are shown with review guidance; they are never rewritten automatically. Onboarding uses the same editor. Settings links to it, preserving unrelated preferences and returning to Settings afterward. A successful empty save stays empty.

Calendar and Home read the exact hours; split periods have distinct identities. Calendar subtracts plans and blocks and keeps openings as short as 15 minutes. Weekly hours stay at the same wall-clock time across daylight-saving changes; nonexistent occurrences are skipped. Stubby's context and ranking retain exact hours, and a known activity duration must fit the interval to receive the usual-hours preference score. Saved hours remain a preference when someone explicitly asks for a different time. The private setting and access policies are unchanged. No free hours are exported through the calendar subscription.

The existing Calendar uses New York time. This change does not replace its timezone model or add an external calendar connection. The new ranges are stored in the existing owner-only `free_windows` array as local minute ranges; old `day`/`eve` keys remain readable. This requires a new constraint migration and an updated `stubby-scout` deployment. Nothing was merged, applied live or deployed by this task.

## Screenshots

Captured from the running production build in Chromium with an isolated Supabase fixture server. No production account or live data was used.

- [Plan form, phone](01-simple-plan-mobile.png)
- [Plan form, desktop](02-simple-plan-desktop.png)
- [Usual free times, phone](03-usual-free-times-mobile.png)
- [Free-time read failure and Retry, phone](04-free-times-retry-mobile.png)
- [Copy hours to other days, phone](05-copy-hours-mobile.png)
- [Exact hours in Calendar, phone](06-exact-hours-calendar-mobile.png)

## Reproduce

```sh
VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_ANON_KEY=fixture-anon-key npm run build -- --outDir dist-calendar-integration --emptyOutDir
node scripts/e2e/calendar-simple-planning.ts
node scripts/check-weekly-hours-db.mjs
```

Unit coverage includes the saved-choice load gate, failed-load Retry, explicit empty save, return to Calendar, failed-save retry, account switch, exact slot time retention across day edits, Corner selection invalidation and daylight-saving gaps.

## Results

- App regression: 192 tests passed across 14 files. Stubby regression: 465 tests passed across 20 files. The final 11-file focused run passed 156 tests, including the layout and browser-only privacy checks.
- Full suite: 2,319 tests passed; the page-width and browser-only import guards failed before their fixes. Both passed in the final focused run without weakening their tests. The original full run is not reported as fully green.
- Isolated PostgreSQL: 15 checks passed, including retaining existing selections, constraint rejection of invalid writes, boundaries, split ranges, midnight, DST, and updating the Home score and its explanation together. This is a minimal schema, not a production replay. Live verification creates no fixture records and intentionally ends with a RESULTS exception and rollback.
- The owner ran `docs/verification/calendar-weekly-hours/preflight.sql` against live Supabase. It confirmed the existing 14-choice constraint and both expected Home ranking anchors. The migration refuses an unexpected ranking definition instead of replacing unrelated code.
- Final type checking, token lint and production build passed. The existing large-chunk warning remains.
- Final Chromium run: 17 checks passed, six actual viewport screenshots, no page errors.

## Release

1. Review the updated Calendar planning PR. No agent merge is permitted.
2. After merge, apply `supabase/migrations/20261117000000_weekly_free_hours.sql` from main. It is under 100 lines. It changes validation and two availability checks in Home ranking, preserving other ranking logic and all existing stored values/policies.
3. Run `supabase/verification/weekly_free_hours_check.sql`. Its final `RESULTS: PASS ...` exception intentionally rolls back. The script performs only assertions and creates no fixture records. Investigate any FAIL or other error.
4. Redeploy `stubby-scout` from merged main with its shared modules and existing deployment configuration. No new secrets or external calendar access are required. Its existing environment and authentication settings still apply.
5. Confirm the app deployment uses the merged commit. Apply the database change before promoting a client that saves exact ranges. Check a save/reopen, split hours, copy, empty week and Calendar after release.

Calendar integration PR #328's migration/calendar-feed release prerequisites remain separate if not already completed. The current task has no Supabase connector or database credentials and performs no live migration or Edge Function deployment. Repository policy requires written approval naming the merged migration before an agent could apply it.
