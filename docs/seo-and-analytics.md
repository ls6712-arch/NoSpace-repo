# Search, sitemap and Google Analytics

What is in the code, and what only the owner can do (Google accounts, DNS, Vercel).

## In the code

- `public/robots.txt` allows crawling and points to the sitemap.
- `public/sitemap.xml` lists `https://www.onsoosh.com/`. Served at `/sitemap.xml`.
- `index.html` has a description, canonical link and share tags. On any host other
  than onsoosh.com (staging, previews) an inline script adds `noindex`, so only
  the live site is indexed.
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

## Before turning analytics on

The Privacy Policy does not mention Google Analytics yet, and says nothing there
is aspirational. It needs a line (and a lawyer's read) before step 1.

## Limit: only the home page can be indexed

The app uses hash routing (`/#/space/crafting`). Google ignores everything after
`#`, so Spaces, Corners, Moments and profiles cannot be listed in a sitemap or
found in search. Making them discoverable means moving to path routing
(BrowserRouter) with a host rewrite, and rendering public pages for crawlers.
That is a separate project, and it conflicts with the file:// support noted in
`src/app/routes.ts`.
