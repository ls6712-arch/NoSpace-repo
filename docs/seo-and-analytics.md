# Search, sitemap and Google Analytics

What is in the code, and what only the owner can do (Google accounts, DNS, Vercel).

## In the code

- `public/robots.txt` allows crawling and points to the sitemap.
- `public/sitemap.xml` lists `https://www.onsoosh.com/`. Served at `/sitemap.xml`.
- `index.html` has a title, description, canonical link and share tags. On any host other
  than onsoosh.com (staging, previews) an inline script adds `noindex`, so only
  the live site is indexed.
- Share preview: `public/og-image.png` (1200 by 630) is the card shown when a link
  to onsoosh.com is pasted in iMessage, Slack, X, LinkedIn and so on
  (`og:image`, `twitter:card` = `summary_large_image`).
- Icons: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png` and `site.webmanifest`, all drawn from Stubby. Google shows the
  favicon next to the site in search results.
- Structured data: a JSON-LD block in `index.html` describes the WebSite,
  the Organization (with the logo) and the WebApplication, so Google can show
  "Soosh" as the site name. Add Instagram and TikTok to the Organization as
  `sameAs` once `INSTAGRAM_URL` and `TIKTOK_URL` in `src/app/config.ts` are set.
- Crawler copy: inside `<div id="root">` in `index.html` is a plain-HTML copy of
  the landing page (hero, how it works, solo picks, Stubby, FAQ). AI crawlers
  (GPTBot, ClaudeBot, PerplexityBot) and most link previewers don't run
  JavaScript, so without it they saw an empty page. React replaces it on first
  render, so people never see it. `src/indexHtml.test.ts` fails if the FAQ or the
  steps drift from `src/app/landing/copy.ts`; update both together.
- FAQ structured data: the JSON-LD block also has a `FAQPage` with the landing FAQ.
- `public/llms.txt` is a short plain-text summary of Soosh for AI assistants.
- `vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every host except
  `www.onsoosh.com` (staging on trynospace.com, previews, *.vercel.app). This
  works for crawlers that never run the inline noindex script.
- Custom events: every `track()` call in `src/app/lib/analytics.ts` is also sent
  to GA4 as an event of the same name. Fields ending in `Id` are dropped, so GA
  never sees which Moment or Pursuit. `sign_up` and `login` (GA4's own event
  names, with the provider as `method`) are sent once per sign-in from
  `AuthContext`. In GA4 > Admin > Events, mark `sign_up` as a key event.

To regenerate the icons or the share card after a brand change, render Stubby
from the landing page (`.lp-logo-mark svg` for the icons, the hero Stubby for
the card) and screenshot it with Playwright at the sizes above.
- `src/app/lib/googleAnalytics.ts` loads GA4 only when `VITE_GA_MEASUREMENT_ID` is
  set, only on onsoosh.com, and not for Do Not Track or Global Privacy Control.
  Page views are sent by hand with the first part of the route only
  (`/moment`, `/u`, `/i`), so ids, usernames, invite codes and sign-in or
  password reset tokens never reach Google.

## Owner steps

1. **Google Analytics.** analytics.google.com > create a GA4 property and a Web
   data stream for `https://www.onsoosh.com`. Copy the Measurement ID (`G-...`).
   In Vercel > Settings > Environment Variables add `VITE_GA_MEASUREMENT_ID`
   for **Production only**, then redeploy `main`.
2. **Search Console.** search.google.com/search-console > Add property > **Domain**
   `onsoosh.com`. Add the TXT record it gives you at your DNS host. A Domain
   property covers www and non-www.
3. **Submit the sitemap.** In Search Console > Sitemaps, enter `sitemap.xml`
   (under the www property, or the Domain property).
4. In Search Console > URL Inspection, inspect `https://www.onsoosh.com/` and
   choose Request indexing.
5. In GA4 > Admin > Product links, link Search Console.
6. In GA4 > Admin > Events, mark `sign_up` as a key event once it shows up
   (a day after the first sign-up on the live site).
7. **Bing.** bing.com/webmasters > Import from Google Search Console. This also
   covers DuckDuckGo and Yahoo, and ChatGPT search, which draw on Bing's index.
8. Check the share card at opengraph.xyz (or by pasting the link in Slack or
   iMessage) after the deploy.

## Analytics is on

The GA4 id (`G-8YTJ1TY113`) is built in, so no Vercel variable is needed
(`VITE_GA_MEASUREMENT_ID` overrides it; set it empty to turn analytics off). The
Privacy Policy has a Google Analytics paragraph; it still needs a lawyer's read.
Step 1 above is done.

## Limit: only the home page can be indexed

The app uses hash routing (`/#/space/crafting`). Google ignores everything after
`#`, so Spaces, Corners, Moments and profiles cannot be listed in a sitemap or
found in search. Making them discoverable means moving to path routing
(BrowserRouter) with a host rewrite, and rendering public pages for crawlers.
That is a separate project, and it conflicts with the file:// support noted in
`src/app/routes.ts`.
