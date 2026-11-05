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
