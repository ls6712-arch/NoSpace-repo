# Soosh SEO + AEO launch checklist

## Positioning
Soosh helps people discover hobbies, find things to do, plan activities with friends, and make progress on personal goals. Primary journey: discover → plan → do → keep going.

## Changes in PR #350
- Crawlable public HTML guides for hobbies, social life, activities, boredom, planner and personal goals.
- Each guide includes a unique title, description, canonical URL, useful answer-first copy, structured data and contextual links.
- Homepage branded title and description strengthened.
- XML sitemap includes the homepage and 37 public guide URLs.

## Required before merging
1. Run `npm ci`, `npm run build`, `npm test` and `npm run lint`; investigate failures, including any pre-existing lockfile problems.
2. Verify Vercel preview serves each `/hobbies/.../`, `/planner/.../`, `/activities/.../`, `/social-life/.../`, `/goals/.../` URL as its **own static HTML** with HTTP 200, not the homepage SPA fallback.
3. Confirm no `X-Robots-Tag: noindex` or HTML `noindex` on production `www.onsoosh.com` pages; ensure preview hosts remain noindexed.
4. Check canonical tags, unique metadata, mobile readability, navigation, and real CTA behavior for signed-out users.
5. Review each guide for accuracy, originality and depth. Add specific examples, realistic cost/time ranges and links to relevant real Soosh activities. Do not publish thin or duplicated pages merely for keywords.
6. Ensure `onsoosh.com` redirects to `www.onsoosh.com` and that HTTPS is consistent.
7. Submit `https://www.onsoosh.com/sitemap.xml` in Google Search Console **after deployment**; request indexing for the pillar pages. Indexing and rankings are not guaranteed.
8. Verify Google Analytics 4 organic traffic and meaningful product events (guide → discover, guide → planner, account creation, activity plan creation).
9. Validate structured data using Schema.org validator and Google Rich Results Test; structured data does not guarantee rich results or AI citations.
10. Confirm public content is accessible to OAI-SearchBot and other desired search crawlers without exposing authenticated data.

## Measurement: weekly
- Google Search Console: branded `soosh` and non-branded query impressions, clicks, CTR, average position; indexed URL count; crawl errors.
- GA4: organic landing pages, guide-to-product clickthrough, activity plans created, return visitors.
- AEO prompt panel: test 30–50 consistent unbranded prompts in ChatGPT and other engines, recording citation URL, mention and recommendation. Do not treat small samples as market-wide visibility.
- Prioritize improving pages with impressions but low CTR, and pages with engaged visitors but low product exploration.

## Editorial keyword clusters
- Hobbies: how to find a hobby, hobbies for adults, women, men, easy, free, creative, niche.
- Boredom: things to do when bored, bored at home, alternatives to scrolling.
- Social: things to do with friends, make friends through hobbies, weekly social planning.
- Planner: weekend planner, weekly hobby planner, make time for hobbies.
- Goals: personal goals examples, goals with friends, hobby goals.

**Never merge this PR to main without the founder's explicit approval.**
