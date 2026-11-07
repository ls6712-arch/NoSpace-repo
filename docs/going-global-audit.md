# Going global: the New York audit (Nov 7, 2026)

Brief: `claude-code-brief-corner-activities-global.md`, section 7.1. Every hit in the repo for `NYC`, `New York`, `Brooklyn`, `Manhattan`, `Queens`, `Bronx`, `Staten Island`, `America/New_York` and `new-york`, grouped as **Change** (done in this PR), **Keep**, and **Ask** (the founder decides). Reproduce with:

```
grep -rInE 'NYC|New York|Brooklyn|Manhattan|Queens|Bronx|Staten Island|America/New_York|new-york' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .
```

**564 hit lines** in the tree after this PR (the three edits below are already out of the count):

| Group | Lines | What |
|---|---|---|
| Keep: history | 231 | `docs/`, past migrations and verification scripts, seed data, evals: a record of what was built or applied, never edited (CLAUDE.md: migrations are append-only) |
| Keep: tests and fixtures | 177 | Test fixtures, e2e and visual-audit data. They follow whatever the code under test does; they change in the same PR as the Ask items below |
| Keep: data | 63 | The NYC neighborhood list, the city-key list (`new-york-ny` is a real key in the approved fixed list), the standing NYC schedule (`SLOT_CITY`). Real cities in a list, not a default |
| Keep: code comments | 52 | Comments and doc comments. Not user-facing |
| **Ask** | 41 in 23 files | Below |

## Change (done in this PR)

| Where | Before | After |
|---|---|---|
| `public/llms.txt` | "...one thing to do with your free time in New York." / "It is in New York first, with more cities after that." / "People in New York who are free tonight..." | New York removed from all three |
| Log a Moment, place field placeholder | "e.g. Prospect Park, Brooklyn" | "e.g. the park by your place" |
| Settings, neighborhood field help | "Shown under your name, like Greenpoint, Brooklyn." | "Shown under your name, like your neighborhood or town." |
| Catalog `nyc_fit` | `city`, `seasonal`, `day_trip`, `hard` | Generated as `reach`: `anywhere`, `seasonal`, `travel`, `needs_place`. The CSV column is unchanged. Nothing ranked on it, so no ranking change |
| Sitemap | Hand-kept `public/sitemap.xml`, no `lastmod` | Generated at build (see below) |

Already global, checked and left alone: the page title and description, Open Graph and Twitter tags in `index.html` (no New York wording; the canonical and share URLs are `https://www.onsoosh.com/`), the landing page copy (the landing e2e asserts there is no "This weekend in NYC"), and all 28 sitemap URLs.

## Ask: proposed answer for each of the 41 lines

The New York assumption is mostly **logic**, not copy: the product works in one time zone and one city. Changing words without the logic would make them false ("Times shown in New York." is true today), so each line below has a proposed answer and the PR that carries it. **Founder decisions of Nov 7, 2026 are marked "decided"**; the rest are proposals to approve in one go.

| PR | What |
|---|---|
| **E** | Per-person time zone (decided): the browser's time zone saved on the profile, used for Stub days and everything that used `HOME_TZ`; the `stubby-scout` prompts use the person's city instead of New York. One edge-function redeploy, before the deploy token expires on Nov 13 |
| **F** | City (decided): "This week in {city}" only where that city has picks, otherwise the section is hidden; the standing schedule loses its NYC framing; onboarding's Where screen accepts any city and maps it to the city-key list |
| **G** | Distances in km or miles by the person's locale (decided) |

New copy these need (for approval, added to the glossary in the PR that uses it): "Times shown in your time zone." ; "This week in {city}" ; "{City} time" ; the Where screen's no-match line.

| # | Where | Line | Proposed answer | PR |
|---|---|---|---|---|
| 1 | `StandingSlotForm.tsx:101` | hint "New York time" | "{City} time", from the time zone of the slot's city key (each key in the city list carries a zone) | F |
| 2 | `calendarView.ts:153` | month subline ends in "New York" | Drop the place; show the person's city name when they have one, else nothing | E |
| 3 | `calendarView.ts:160` | week, day and list sublines end in "New York" | Same as 2 | E |
| 4 | `interests.ts:27` | `CITY_SUGGESTIONS` (Bangalore, New York, Mumbai, Delhi, ...) | **Keep.** An example list that already spans countries; it becomes the names in the city-key list when PR 4 builds it | |
| 5 | `cityPicks.ts:18` | `CITY = "new-york"` | Each pick carries its own city key (the column exists); the Week view asks for the person's city key | F |
| 6 | `homeCopy.ts:12` | `place: "New York"` | The person's city name; nothing when they have none | F |
| 7 | `homeCopy.ts:15` | "This week in New York" | "This week in {city}", shown only where that city has published picks, else the section is hidden (decided) | F |
| 8 | `homeCopy.ts:48` | admin intro mentions "This week in New York" | "The hand-picked things on the Week view, for the cities you choose. Published picks show to everyone signed in whose city has them." | F |
| 9 | `homeWeek.ts:13` | `HOME_TZ = "America/New_York"` | The person's time zone (`profiles.time_zone`, the browser's by default, editable); no zone yet: the browser's | E |
| 10 | `AdminCityPicks.tsx:193` | hint "New York time" | "{City} time" for the pick's city | F |
| 11 | `WhereScreen.tsx:58` | "That's outside New York. Type your city instead." | Accept any typed city; map it to the city-key list (exact match, per `docs/city-keys-plan.md`); no match: keep the text as their city, no key, no error. Location: the nearest key in the list, else leave it blank. The NYC neighborhood list stays as the finer choice for New York only (decided) | F |
| 12 | `FreeScreen.tsx:70` | "Times shown in New York." | "Times shown in your time zone." | E |
| 13 | `WeekFree.tsx:83` | "Times shown in New York." | Same as 12 | E |
| 14 | `calendar-feed/plans.ts:23` | day of a plan in `America/New_York` | The feed owner's `time_zone`; none: UTC | E |
| 15 | `stubby-scout/askPrompt.ts:52` | "...helps people in New York City find things to do outside work." | Built from the person's city: "...helps people in {city} ..."; no city: "...helps people find things to do near them." | E |
| 16 | `stubby-scout/askPrompt.ts:53` | "...real things in New York City that fit them" | "...in {city}" the same way; no city: "near them" | E |
| 17 | `stubby-scout/askPrompt.ts:64` | "Times are New York local time" | "Times are local time in {zone}" (the person's zone) | E |
| 18 | `stubby-scout/askPrompt.ts:124` | "It is now ... in New York." | "It is now ... in {zone}." | E |
| 19 | `stubby-scout/ask.ts:118` | `nyHour` in `America/New_York` | The hour in the person's zone | E |
| 20 | `stubby-scout/search.ts:66` | "...people in New York City..." | As 15 | E |
| 21 | `stubby-scout/search.ts:67` | "search ... in New York City" | As 16 | E |
| 22 | `stubby-scout/search.ts:75` | "Times are New York local time" | As 17 | E |
| 23 | `stubby-scout/search.ts:91` | "It is now ... in New York." | As 18 | E |
| 24 | `stubby-scout/search.ts:92` | "Find up to N activities in New York City" | "...in {city}"; no city: "near the person" | E |
| 25 | `stubby-scout/search.ts:273` | web-search `user_location` is New York, US | From the person's city and zone; omitted when unknown | E |
| 26 | `stubby-scout/README.md:6` | restock at 4 to 6 a.m. New York time | Restock per time zone, or stay one global hour with the wording corrected; I would keep one run and say "UTC" in the doc | E |
| 27 | `stubby-scout/README.md:22` | "a New York start time" | "a start time in the person's zone" | E |
| 28 | `stubby-scout/picks.ts:14` | `HOME_TZ = "America/New_York"` | The person's zone, passed in | E |
| 29 | `stubby-scout/handler.ts:53` | `CITY = "new-york"` | The person's city key | F |
| 30 | `stubby-scout/handler.ts:540` | weekly-hours text ends "America/New_York" | The person's zone | E |
| 31 | `stubby-scout/handler.ts:629` | default zone `America/New_York` | The person's zone, else UTC | E |
| 32 | `stubby-scout/v3/context.ts:22` | default zone `America/New_York` | The person's zone, else UTC | E |
| 33 | `stubby-scout/v3/context.ts:36` | no city at all means "New York" | No city means no city (the prompts above already handle it) | E |
| 34 | `stubby-scout/v3/request.ts:111` | `CITIES` recognizer list starts with New York | **Keep.** A list of cities to recognize in text, not a default; extended from the city-key list later | |
| 35 | `stubby-scout/v3/careResources.ts:102` | no city and no zone: the US card; any zone but New York's: the "elsewhere" card | **Needs your confirmation (safety).** By country from the zone (any US zone gets the US card, as today for New York); with no city and no zone, show the "elsewhere" card, not the US card | E |
| 36 | `_shared/capabilityProfile.ts:27` | default `timeZone: "America/New_York"` | Default from the profile's zone, else UTC | E |
| 37 | `_shared/capabilityProfile.ts:44` | error message "such as America/New_York" | "such as Europe/London" | E |
| 38 | `_shared/weeklyHours.ts:3` | `WEEKLY_HOURS_TIME_ZONE = "America/New_York"` | The person's zone, passed in | E |
| 39 | `_shared/weeklyHours.ts:60` | default `zone = "America/New_York"` | No default; callers pass it | E |
| 40 | `_shared/preferenceTime.ts:2` | `localClock` default zone | No default; callers pass it | E |
| 41 | `_shared/preferenceTime.ts:6` | `preferenceTimeScore` default zone | No default; callers pass it | E |

### Also decided, not a line above

- **Time zone in SQL.** 12 migrations compute New York days, including `stubs_four_kinds` (which local day a Stub belongs to) and the weekly-free-hours functions. PR E adds the zone as an argument and reads `profiles.time_zone`, in a new migration with a rollback and a verification script. Past migrations are not edited.
- **Distances (PR G).** One `formatDistance` helper: kilometres, or miles for the US, UK and the other countries that use them, from the person's locale (`Intl` and the browser's language, with a per-country override list). Corner text that hard-codes miles ("Walk a trail under three miles", the hiking first step) is rewritten to carry a distance the helper formats; the content changes are listed in that PR for approval.
- **Money.** Event prices are the host's own words (kept). Activity cost stays Free, Low cost or Treat. The Week budget is an amount the person picks (kept).
- **Locale.** `og:locale` stays `en_US` until there is a translation.

## Sitemap, robots and routing

- **Before:** `public/sitemap.xml`, a hand-kept static file with 28 URLs, no `lastmod`. **Now:** `scripts/build-sitemap.ts` writes `dist/sitemap.xml` at build (`npm run build`), from every `public/**/index.html` plus the home page, skipping any page that says `noindex`; `lastmod` is the build date; no `changefreq` or `priority`; it refuses more than 50,000 URLs. The committed file is removed. A new page under `public/` appears on the next build.
- **Routing check:** the app uses `createHashRouter` (`src/app/routes.ts`). Search engines ignore everything after `#`, so `/#/corners`, category pages and Corner pages are not separate indexable pages and are **not** in the sitemap. Only real paths that return their own HTML are: `/` and the 27 guide pages under `/hobbies/`, `/planner/` and `/social-life/`. No city-specific URL, no preview or staging host, nothing behind sign-in.
- **`robots.txt`:** points to `https://www.onsoosh.com/sitemap.xml`. The staging host (`trynospace.com`, `www.trynospace.com`, the two in `STAGING_HOSTNAMES`) gets `robots-staging.txt` (`Disallow: /`) through a host rewrite in `vercel.json`. `index.html` already adds `noindex` off the live host; this adds the crawl block.
- **What moving to a browser router would take (proposal only, not done):** (1) `createBrowserRouter` plus a Vercel rewrite of unknown paths to `index.html`, with static pages and assets excluded; (2) the OAuth and magic-link return that parses the URL hash (`AuthContext`) re-done for paths; (3) the 10 lines in 9 app files, and the calendar feed, that build `/#/...` links, and about 24 e2e and visual-audit scripts that open hash URLs; (4) the `file://` support that `routes.ts` says is the reason for hash routing would go; (5) and routing alone is not enough: Corner and category pages are client-rendered, so crawlers need prerendered HTML per page (titles, descriptions, Open Graph) to get anything out of it. That is a separate project.

## Not touched

The Corner activities, mood filters and user-added activities (PRs A to C of the same brief) are not in this PR. They need `corner_activities.csv`, which was not in the repo or in the session when I started.
