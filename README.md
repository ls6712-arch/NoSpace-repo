# NoSpace

"Create, Don't Just Consume." A hobby-based content + marketplace app built from the
NoSpace Figma Make file, extended with the creator/rewards concept described in chat.

## What's here

- **Home** — hero with the tagline, the 5 hobby spaces (Crafting, Mysticism, Sports,
  Recreation, Collecting), a "how it works" section, a discovery feed ("Fresh across
  NoSpace"), and an "Explore next" section suggesting spaces you haven't engaged with.
- **Space feed** (`/space/:slug`) — three tabs per hobby: **For you** (public posts,
  algorithmically ranked), **Circles** (join/leave hobby circles — global topic circles
  and geographic sub-circles — and view a circle's own feed), and **Marketplace**
  (for-sale items and courses for that hobby).
- **Creator Studio** (`/create`) — follows a **Log → Reflect → Share → Earn** flow: log
  what you made, jot an optional private reflection (never shown publicly — only you
  see it, in your own Portfolio), then choose who sees the post (**Friends** is the
  default / **Circle** — picking it prompts you to pick one of that hobby's circles /
  **Public** is opt-in, not default), and optionally toggle "list this for sale" to
  turn it into a marketplace listing in the same step.
- **Profile** (`/profile`) — a single headline stat ("N things created," not a stat
  dashboard), hobby tags for the spaces you actually engage with, a quiet
  (non-leaderboard) achievements strip, a circles-joined list you can hide, a
  creator-vs-consumer balance, and a chronological visual portfolio.
- **Marketplace** (`/shop` + `/product/:id`) — all listings across every space, filterable
  by hobby, with a cart and checkout flow.

## Social sharing: three tiers, not more

Every post picks one audience in Creator Studio, chosen per-post (not a global account
setting):

- **Friends** — visible only to people who follow you back. This is the default, since
  the goal is to keep the moment of posting low-friction.
- **Circle** — visible only inside one hobby circle you pick (joining that circle
  automatically, if you hadn't already).
- **Public** — visible in that space's main feed to anyone. Opt-in, never the default.

There's no real multi-user backend here (see "What's intentionally mocked" below), so
Friends-only posts are stored with that visibility tag but there's no second account to
verify the restriction against — treat it as the data model and UI for the feature, not
an enforced privacy boundary yet.

## Circles: hyperlocal, hobby-first

Circles are scoped to a hobby, not to a region — there's no separate "app" or space per
city. Each hobby has one or more circles; some are global/topic-based (e.g. "Crafting
Beginners"), and some carry an optional `location` field as a geographic sub-layer
within that same hobby (e.g. "NYC Pottery Beginners"). See `src/app/data/circles.ts`.
Joining/leaving is local state, persisted to `localStorage`.

## The two algorithms

- **Discovery feed** (`scorePost` in `ContentContext.tsx`) — ranks public posts by
  recency (decaying to zero over ~10 days) plus a relevance bonus if the post's hobby is
  one you're actively engaged in (posted in, or joined a circle for), with raw like
  count capped and given only a minor weight. This deliberately keeps the feed from
  collapsing into an engagement-maximizing sort.
- **"Explore next"** (on Home) — a simple gap check: any hobby you haven't posted in and
  haven't joined a circle for gets suggested. No engagement-time optimization; the
  implicit goal is "did you go create or join something," not "did you stay longer."

## Look and feel

A dark, futuristic palette that's been tuned down from an earlier, more neon version —
indigo, sky blue, and dusty magenta on near-black rather than pure electric colors, so
it reads as "instrument panel" without being visually harsh. Sharper corners than a
typical soft SaaS UI, and a monospace type treatment on stat readouts (points, level,
the profile headline stat). See `src/styles/theme.css` for the full token set.

The landing page (`Home.tsx`) is structured like a Fable-style app site: a hero, a
big continuously-scrolling "HOBBYMAXXING" marquee banner (pure CSS, no video), then
alternating feature sections (the Log → Reflect → Share loop, Circles, Profile) each
paired with a small illustrative panel, real quotes pulled from seed posts, then the
live trending feed.

### Images: generated, not fetched

Every cover image in the app — hobby cards, post thumbnails, product photos, cart
items — is **procedurally generated** by `src/app/components/GeneratedArt.tsx` rather
than loaded from a photo URL. It draws a gradient background in that hobby's colors,
two soft blurred "blobs," and a centered icon, all from a seed (the post/product id),
so the same item always renders the same art and nothing ever depends on an external
image loading. This was a deliberate substitution: real stock-photo URLs (e.g.
Unsplash) can't reliably load in every environment this prototype might be viewed in,
so generated art guarantees every hobby and post always has a real, consistent-looking
cover with zero network dependency. If you deploy this somewhere with normal internet
access, you can swap `GeneratedArt` back out for `ImageWithFallback src={...}` (still
in `src/app/components/ImageWithFallback.tsx`) and point `media`/`image` fields at real
photo URLs.

## Rewards, as implemented

- Post content: **+50 pts**
- Like a post: **+2 pts** (toggle off to remove)
- Visit a new space for the first time: **+5 pts**
- Checkout an item: **+10 pts per item**
- Badges unlock automatically off these stats (see `src/app/data/badges.ts`) — first
  post, 5 posts, 25 likes given, 3 purchases, all 5 spaces visited, 500 pts, 2000 pts.
- Badges are shown as a quiet, unranked "highlights" strip on your profile — never a
  leaderboard — and there's no streak mechanic anywhere, on purpose: rewards are tied to
  things you made or did, not to showing up on consecutive days.
- The profile intentionally shows one headline stat, not a stats dashboard, plus your
  hobby tags and portfolio — the visible "artifact" is the body of things you made, not
  a points counter.

Points, posts you create, listings you list, and circles you join are saved to
`localStorage`, so they survive a page refresh. There's no backend — this is a
front-end prototype.

## What's intentionally mocked

- **Video posts** show a static thumbnail with a play-button overlay — there's no real
  video player wired up, since no video assets were provided. Swap `Post.media` for a
  real video URL and add a `<video>`/player in `ContentCard.tsx` to make it real.
- **"Selling" is one-directional** — when you list something for sale in Creator Studio,
  it appears in that space's Marketplace immediately (no review step), and anyone
  (including you) can "buy" it, which awards the buyer points. There's no real payment
  processing, no way to actually pay out a creator, and no auth — every visitor is
  treated as the same anonymous "You".
- **Friends-only visibility has no second user to test against** — see "Social sharing"
  above.
- **No backend / accounts** — all state lives in the browser. To make this real, you'd
  add auth, a database for posts/listings/points/circles, and a payments provider (e.g.
  Stripe Connect, since creators need to receive money, not just charge it).

## Running it

```bash
npm install
npm run dev      # starts a local dev server
npm run build    # production build to dist/
```

Requires Node 18+.

## Project structure

```
src/app/
  components/       shared UI (Header, ContentCard, ProductCard, cart, badges toast...)
  components/ui/     shadcn-style primitives (button, card, dialog, select, ...)
  context/           CartContext, RewardsContext, ContentContext
  data/               hobbies.ts, posts.ts (seed feed), products.ts (seed marketplace),
                      badges.ts, circles.ts (seed hobby circles)
  pages/              Home, CategoryFeed, CreatorStudio, Profile, Shop, ProductDetail, Root, NotFound
src/styles/           theme.css (the dark/neon palette), fonts.css, tailwind entry
```
