# SEO / AEO production and security verification — 2026-11-08

## Code review findings
- `public/about/index.html` and `public/activities/things-to-do-when-bored/index.html` are present on main after PR #361. This **does not verify live deployment**.
- `vercel.json` sets a restrictive Content Security Policy, HSTS, no-sniff, clickjacking protection, referrer and permissions policies. Do not loosen these to improve SEO without a specific tested need.
- `vercel.json` sets noindex for hosts other than `www.onsoosh.com`. Confirm that the apex domain redirects permanently to www rather than serving a separately indexed copy.
- `public/robots.txt` permits crawling; it is not a security barrier and must not be used to protect private data.
- `api/mcp.ts` is public and intentionally unauthenticated. It exposes curated hobby categories only. Keep it read-only and never add private Supabase queries, tokens or user profile data without separate authorization.
- `api/mcp.ts` now rejects declared oversized POST requests and non-JSON POSTs, and disables response caching. This is only an **initial guard**: clients can omit or falsify Content-Length. An upstream body-size limit and rate limiting are still required for robust abuse protection.
- `llms.txt` is descriptive only and cannot control AI crawlers or enforce access policy.

## Mandatory checks before approval
1. Vercel preview: GET `/about/` and `/activities/things-to-do-when-bored/` must return 200 and the correct HTML; unknown paths should return 404.
2. Inspect actual response headers for CSP, HSTS, X-Content-Type-Options, X-Frame-Options, X-Robots-Tag and content type. Ensure public www pages are not marked noindex.
3. Verify sitemap links resolve, canonical URLs use https://www.onsoosh.com/, and pages are not accidentally duplicated.
4. Verify `/api/mcp` allows only the intended read-only tools; rejects unsupported methods, malformed content types and declared oversized requests without exposing stack traces.
5. Add platform-level rate limiting and an enforced body-size cap for `/api/mcp` before assuming the endpoint is abuse resistant.
6. Verify Supabase Row Level Security is enabled and policies are scoped for all user data; audit storage bucket access and ensure service-role credentials are server-only. **Not verified by this PR.**
7. Verify no secrets in client bundles, public files, GitHub history or deployment logs. Rotate any leaked keys. **Not verified by this PR.**
8. Run `npm ci`, `npm run build`, `npm test` and `npm run lint` in CI. **Not executed in this review.**
9. Submit the live sitemap to Search Console only after HTTP checks pass; monitor indexing and crawl errors.
10. Monitor AI search mentions/citations with repeatable unbranded prompts; do not promise a ranking or recommendation.

Do not merge this PR without founder approval.
