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

## Ask: the founder decides

The New York assumption is not mostly copy. It is **logic**: the product works in one time zone and one city. Changing the words without the logic would make them false ("Times shown in New York." is true today). So these are proposals, not changes.

### A. One time zone for everything the person does (biggest)

`HOME_TZ = "America/New_York"` is used by **17 client files** (Calendar, Week, Home, onboarding free time, Start page, Stubby lines) and **12 migrations**, including `stubs_four_kinds` (which local day a Stub belongs to) and the weekly-free-hours functions. The edge functions have their own copies (`_shared/weeklyHours.ts`, `preferenceTime.ts`, `capabilityProfile.ts` default, `calendar-feed`).

Proposal, as its own PR (PR E): add `profiles.time_zone` (IANA, from the browser, editable), thread it through the 17 files, and give the SQL day boundaries a time-zone argument (new migration, rollback, verification; no editing of past ones). Punch cards and Stubs count by the person's own days. Until then every "Times shown in New York" line stays true.

Lines affected in the client: 5 listed in A below, plus the 17 files that use the constant.

| Where | Line |
|---|---|
| `src/app/lib/calendarView.ts:153` | `return [stubs > 0 ? plural(stubs, "Stub") : null, plansToGo > 0 ? `${plural(plansToGo, "plan")} to go` : null,` |
| `src/app/lib/calendarView.ts:160` | `return [lead, view !== "list" && counts.plans > 0 ? plural(counts.plans, "plan") : null, "New York"].filter(Bo` |
| `src/app/lib/homeWeek.ts:13` | `export const HOME_TZ = "America/New_York";` |
| `src/app/pages/WeekFree.tsx:83` | `<p className="text-caption text-muted-foreground">Times shown in New York.</p>` |
| `src/app/pages/onboarding/screens/FreeScreen.tsx:70` | `<p className="text-caption text-muted-foreground">Times shown in New York.</p>` |

### B. Features that are New York by design

The Week view's hand-picked "This week in New York" row (`cityPicks.ts`, `CITY = "new-york"`), the admin page for it, the standing NYC weekly schedule ("New York is the only city with weekly times for now"), and onboarding's "Where" screen, which maps a location to the nearest of the NYC neighborhoods and says "That's outside New York" otherwise.

Proposal: each follows the person's city key, and a city with no picks or schedule shows nothing (the row hides, as it does today with no picks). "This week in {city}" needs new copy for your approval. Onboarding: accept any city from the city-key list; the NYC neighborhood list stays as the finer choice for New York only.

| Where | Line |
|---|---|
| `src/app/components/standing/StandingSlotForm.tsx:101` | `<Field label="Starts" hint="New York time">` |
| `src/app/lib/cityPicks.ts:18` | `export const CITY = "new-york";` |
| `src/app/lib/homeCopy.ts:12` | `place: "New York",` |
| `src/app/lib/homeCopy.ts:15` | `cityPicks: "This week in New York",` |
| `src/app/lib/homeCopy.ts:48` | `line: "The hand-picked things on the Week view, This week in New York. Published picks show to everyone signed` |
| `src/app/pages/AdminCityPicks.tsx:193` | `<Field label="Starts" hint="New York time">` |
| `src/app/pages/onboarding/screens/WhereScreen.tsx:58` | `setNote("That’s outside New York. Type your city instead.");` |

### C. Edge function prompts and defaults (needs a redeploy)

`stubby-scout` (live version 27, recorded) tells the model "an app that helps people in New York City find things to do" and searches the web for activities "in New York City", defaults the time zone to New York, and defaults a person with no city to New York. Changing any file under `supabase/functions/` turns the `stubby-deploy` check red until it is redeployed and recorded again (the workflow and your token handle that). Ask Stubby is off on live right now, so this is not urgent; I would do it together with PR E so there is one redeploy.

| Where | Line |
|---|---|
| `supabase/functions/_shared/capabilityProfile.ts:27` | `return { version: 1, consent: { memory: false, onboarding: false, feedback: false }, timeZone: "America/New_Yo` |
| `supabase/functions/_shared/capabilityProfile.ts:44` | `if (!validTimeZone(v.timeZone)) throw new Error("Enter a valid timezone, such as America/New_York.");` |
| `supabase/functions/_shared/preferenceTime.ts:2` | `export function localClock(ms:number,timeZone="America/New_York"){` |
| `supabase/functions/_shared/preferenceTime.ts:6` | `export function preferenceTimeScore(p:Personalization,ms:number,timeZone="America/New_York"){` |
| `supabase/functions/_shared/weeklyHours.ts:3` | `export const WEEKLY_HOURS_TIME_ZONE = "America/New_York";` |
| `supabase/functions/_shared/weeklyHours.ts:60` | `zone = "America/New_York",` |
| `supabase/functions/calendar-feed/plans.ts:23` | `timeZone: "America/New_York",` |
| `supabase/functions/stubby-scout/README.md:6` | `- **Each morning** (`{"mode":"restock"}`): pg_cron calls it every 10 minutes from 4 to 6 a.m. New York time (m` |
| `supabase/functions/stubby-scout/README.md:22` | `- a title (80 characters at most) and a New York start time between 1 hour and 14 days away;` |
| `supabase/functions/stubby-scout/ask.ts:118` | `const nyHour = (ms: number) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "` |
| `supabase/functions/stubby-scout/askPrompt.ts:52` | `"You are Stubby's scout for Soosh, an app that helps people in New York City find things to do outside work.",` |
| `supabase/functions/stubby-scout/askPrompt.ts:53` | `"One person asked for ideas. Search the web for real things in New York City that fit them, and report the bes` |
| `supabase/functions/stubby-scout/askPrompt.ts:64` | `"- Times are New York local time, written as YYYY-MM-DDTHH:MM in 24 hour time.",` |
| `supabase/functions/stubby-scout/askPrompt.ts:124` | ``It is now ${msToNyLocal(now)} in New York.`,` |
| `supabase/functions/stubby-scout/handler.ts:53` | `export const CITY = "new-york";` |
| `supabase/functions/stubby-scout/handler.ts:540` | `return weeklyHours(windows).map(r => r.legacy ? `${DAY_WORDS[r.day]} ${r.start===360?"daytime":"evening"}` : `` |
| `supabase/functions/stubby-scout/handler.ts:629` | `const zone = validTimeZone(capability.timeZone) ? capability.timeZone : "America/New_York";` |
| `supabase/functions/stubby-scout/picks.ts:14` | `export const HOME_TZ = "America/New_York";` |
| `supabase/functions/stubby-scout/search.ts:66` | `"You are the scout for Soosh, an app that helps people in New York City find things to do outside work.",` |
| `supabase/functions/stubby-scout/search.ts:67` | `"Your job: search the web for real, dated activities in New York City that someone could go to, and report the` |
| `supabase/functions/stubby-scout/search.ts:75` | `"- Times are New York local time, written as YYYY-MM-DDTHH:MM in 24 hour time.",` |
| `supabase/functions/stubby-scout/search.ts:91` | ``It is now ${msToNyLocal(now)} in New York.`,` |
| `supabase/functions/stubby-scout/search.ts:92` | ``Find up to ${max} activities in New York City that start between one hour from now and ${days} days from now.` |
| `supabase/functions/stubby-scout/search.ts:273` | `user_location: { type: "approximate", city: "New York", region: "New York", country: "US", timezone: "America/` |
| `supabase/functions/stubby-scout/v3/careResources.ts:102` | `if (timeZone && timeZone !== "America/New_York") return CARE_ELSEWHERE;` |
| `supabase/functions/stubby-scout/v3/context.ts:22` | `const timeZone = validTimeZone(c.timeZone) ? c.timeZone : "America/New_York";` |
| `supabase/functions/stubby-scout/v3/context.ts:36` | `const city = parsed.city === null ? null : asked ?? session ?? saved ?? "New York";` |
| `supabase/functions/stubby-scout/v3/request.ts:111` | `const CITIES = ["New York", "New York City", "NYC", "Boston", "London", "San Francisco", "Los Angeles", "Chica` |

### D. Static copy with US units, and money

- **Miles:** Corner guide and idea text hard-codes miles ("Walk a trail under three miles", "Walk two miles with a day bag", the hiking first step "under 3 miles"). Kilometres by default and miles for the US and UK needs those strings to carry a distance, not a unit. Proposal: write them without a distance ("a short trail"), or store `{km, miles}` pairs and format by locale. Your call; it is content, not code.
- **`$`:** event prices come from the host's own words (`firstPlan.ts`: "$12" or "Free") and are shown as written; with event imports cancelled, that is the only source. Cost on activities is Free / Low cost / Treat by design. The Week budget slider (`monthlyBudget`) is an amount the person chooses; I left it, because turning a chosen amount into words changes what it does.
- **City list:** `CITY_SUGGESTIONS` in `interests.ts` (Bangalore, New York, Mumbai, Delhi, ... ) is an example list that already spans countries. Kept.
- **Locale:** `og:locale` is `en_US`. Fine until there is a translation.

| Where | Line |
|---|---|
| `src/app/lib/interests.ts:27` | `export const CITY_SUGGESTIONS = ["Bangalore", "New York", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "` |

## Sitemap, robots and routing

- **Before:** `public/sitemap.xml`, a hand-kept static file with 28 URLs, no `lastmod`. **Now:** `scripts/build-sitemap.ts` writes `dist/sitemap.xml` at build (`npm run build`), from every `public/**/index.html` plus the home page, skipping any page that says `noindex`; `lastmod` is the build date; no `changefreq` or `priority`; it refuses more than 50,000 URLs. The committed file is removed. A new page under `public/` appears on the next build.
- **Routing check:** the app uses `createHashRouter` (`src/app/routes.ts`). Search engines ignore everything after `#`, so `/#/corners`, category pages and Corner pages are not separate indexable pages and are **not** in the sitemap. Only real paths that return their own HTML are: `/` and the 27 guide pages under `/hobbies/`, `/planner/` and `/social-life/`. No city-specific URL, no preview or staging host, nothing behind sign-in.
- **`robots.txt`:** points to `https://www.onsoosh.com/sitemap.xml`. The staging host (`trynospace.com`, `www.trynospace.com`, the two in `STAGING_HOSTNAMES`) gets `robots-staging.txt` (`Disallow: /`) through a host rewrite in `vercel.json`. `index.html` already adds `noindex` off the live host; this adds the crawl block.
- **What moving to a browser router would take (proposal only, not done):** (1) `createBrowserRouter` plus a Vercel rewrite of unknown paths to `index.html`, with static pages and assets excluded; (2) the OAuth and magic-link return that parses the URL hash (`AuthContext`) re-done for paths; (3) the 10 lines in 9 app files, and the calendar feed, that build `/#/...` links, and about 24 e2e and visual-audit scripts that open hash URLs; (4) the `file://` support that `routes.ts` says is the reason for hash routing would go; (5) and routing alone is not enough: Corner and category pages are client-rendered, so crawlers need prerendered HTML per page (titles, descriptions, Open Graph) to get anything out of it. That is a separate project.

## Not touched

The Corner activities, mood filters and user-added activities (PRs A to C of the same brief) are not in this PR. They need `corner_activities.csv`, which was not in the repo or in the session when I started.
