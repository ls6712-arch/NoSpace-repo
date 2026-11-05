# Existing Corner cards as a carousel

The owner clarified that Discover should keep its existing presentation. The
earlier broader proposal has been removed from `feature/discover-corner-carousel`.
This correction is based on main `d06c795` and keeps the existing Corner section
in its original place below Ideas.

## Final scope

- Wrap the existing three Corner cards in the existing `HorizontalRow` carousel.
- Give the cards a scrollable width with a partial next card on phones.
- Opt this row into native keyboard scrolling with a focusable list. Other
  `HorizontalRow` callers retain their behavior.

The section order, jump chips, wording, small thumbnails, Follow buttons and
Corner tabs match main. The same six-result request, three-card display, ranking,
loading/error behavior and signup gates are preserved. There are no new large
photos, preference changes, shared SnapCarousel changes or changes to other pages.

The only production files changed from main are `Discover.tsx`,
`CornerTearCard.tsx` (an optional width class) and `HorizontalRow.tsx`
(an optional focusable-list flag). The remaining diff is regression coverage
and this review evidence.

## Validation

Full suite: 246 files, 2,337 tests passed. The existing Discover tests and a
new regression pass: 21 tests. TypeScript,
token lint and the production build pass. The existing Vite bundle-size warning
remains. Migration ordering and tracked-output checks pass.

[Browser evidence](browser-report.json) checks the existing section order, three
compact cards, unchanged request limit, keyboard scrolling, physical touch swipes
or desktop arrows, existing Corner/directory links and Back restoration at
320, 390, 768 and 1440 px, including dark mode. Services are fixtures. Remote
photos and fonts are blocked here, so captures show the existing thumbnail
fallbacks and system fonts. No replacement photograph or live result is implied.

![Existing Corner cards on desktop](desktop.png)

![Existing Corner cards on a phone](mobile.png)

## People and Moments preview correction

Earlier captures returned no Discover Moments in the browser fixture. That also
hid People near you, since it displays the authors of the Discover feed. Those
captures did not accurately show the surrounding page. The fixture now supplies
four example Moments and their authors and asserts that both sections render.
This changes test data and review evidence only. No People/Moments production
component, feed rule, styling or API call has been changed.

The [desktop full-page preview](desktop-full.png) and
[phone full-page preview](mobile-full.png) include both sections. Names, media
and activity choices are fixtures, not a copy of a live account.

A separate [comparison with main](outside-comparison.json) used the same clock
and populated fixtures on main d06c795 and carousel branch 019c650. Ideas,
People and Moments had matching text, links, buttons, widths and heights on
mobile and desktop. Pixel counts are recorded honestly: Ideas matched exactly;
People/Moments section captures have small raster differences after the shorter
Corner row moves them vertically. Their source components are identical.
The comparison does not claim identical absolute vertical positions or a live
production result.

## Reproduce

```sh
npm test -- src/app/pages/Discover.test.tsx
npx tsc --noEmit
npm run lint
PLAYWRIGHT_CHROMIUM=/usr/bin/chromium node scripts/e2e/discover-corners.ts --out /tmp/discover-carousel-only
```

Omit the browser variable for a Playwright-managed Chromium installation.
The browser script builds temporary production assets with the actual CSP.

No database, provider, quotas, age/care checks or production flags change.
No merge or deployment was performed. Real-iPhone/WebKit, external-photo loading
and live-service checks remain release checks. Rollback is a frontend revert.
