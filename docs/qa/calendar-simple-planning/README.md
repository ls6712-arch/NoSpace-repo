# Simpler Calendar planning and usual free times

The plan form uses a Corner search and two visible date/time fields. Selecting a calendar slot preserves that exact time. Changing the day keeps the time; there is no Daytime/Evening toggle to clear it. The title stays Make a plan instead of repeating an outdated time. Bring someone reveals the optional friend picker. Empty Corner choices have initial suggestions, changing the search clears the previous selection, and selected Corners do not show a false no-match message. Empty, past and nonexistent daylight-saving times cannot be submitted.

The empty-time menu retains its three separate actions: make a plan, declare free time, or block time. Its plan button no longer repeats the time already in the heading.

The usual-free-times editor loads saved choices strictly before editing or saving. A failed read shows Retry instead of permitting an empty overwrite. Saving no selected windows writes an explicit empty array. Failed saves retain the selection. Account changes reset the editor and discard late responses. The existing weekly model remains two broad windows per day; the screen now shows their actual ranges, 6 AM to 6 PM and 6 PM to midnight. Save sits directly below the choices instead of at the bottom of a mostly empty page. Exact one-off free time and blocks are still edited in Calendar.

No database migration was added for these screen fixes. Calendar integration PR #328 is merged; its documented migration and calendar-feed deployment remain prerequisites if not yet applied. Nothing was merged or deployed live.

## Screenshots

Captured from the running production build in Chromium with an isolated Supabase fixture server. No production account or live data was used.

- [Plan form, phone](01-simple-plan-mobile.png)
- [Plan form, desktop](02-simple-plan-desktop.png)
- [Usual free times, phone](03-usual-free-times-mobile.png)
- [Free-time read failure and Retry, phone](04-free-times-retry-mobile.png)

## Reproduce

```sh
VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_ANON_KEY=fixture-anon-key npm run build -- --outDir dist-calendar-integration --emptyOutDir
node scripts/e2e/calendar-simple-planning.ts
```

Unit coverage includes the saved-choice load gate, failed-load Retry, explicit empty save, return to Calendar, failed-save retry, account switch, exact slot time retention across day edits, Corner selection invalidation and daylight-saving gaps. 

## Results

- Calendar edit tests: 28 passed at normal timeouts. Usual-free-time tests: 5 passed at normal timeouts. Onboarding and copy checks also passed.
- The first five-file run passed 102 tests and hit three five-second Calendar test timeouts. A normal-timeout Calendar rerun hit three different timeouts. All 48 Calendar tests then passed in a diagnostic run with `--testTimeout=30000`. Repository timeout settings were not changed; the default-timeout runs are not reported as fully green.
- Type checking and design-token lint passed. Production build passed with the existing large-chunk warning.
- Chromium: 13 checks passed, four actual viewport screenshots, no page errors. Covers the simplified form, no time-erasing toggle, no false Corner error after selection, exact slot time retained after changing the day, free-time ranges, reachable Save, explicit empty save, reopen persistence, failed-read save blocking and Retry.
- No live SQL or deployment was performed for this change.
