# NoSpace

**Create, don't just consume.** A hobby app built around logging what you
actually make — a photo, a note, a small win — rather than a feed to scroll.
Real accounts, a real Postgres database (Supabase), and row-level security
enforced in the database itself, not just in the UI.

This README replaces the old one, which described an early, backend-less
prototype (5 hobby spaces, a dark "instrument panel" theme, no accounts).
None of that reflects the app as it exists now — everything below does.

## Core concepts

The app has its own vocabulary. User-facing copy uses these words
consistently, and the code mostly does too (a few internal names — `Project`
for what the UI calls a **Pursuit**, `Post` for what it calls a **Moment** —
are historical and kept only to avoid a mechanical rename across every call
site).

| Term | What it means |
| --- | --- |
| **Moment** | One logged entry — a photo, a note, a small update. The unit everything else is built from. |
| **Pursuit** | An ongoing body of work you come back to ("Learning the trumpet," "Restoring a 1974 bike"). Optionally tagged to a Space/Corner. Can be private or explicitly shared to your public profile. |
| **Goal** | One optional, non-scoring attribute on a Pursuit — a number, a date, or "a feeling, not a number." Never turned into a percentage or a streak. |
| **Space** | One of 15 fixed, curated hobby categories (`src/app/data/hobbies.ts`) — Food & Cooking, Sports & Fitness, Art & Creative, Crafts & Making, Books & Writing, Nature & Outdoors, Home & Garden, Gaming & Tabletop, Music, Photography & Film, Health & Wellness, Fashion & Beauty, Tech & Building, Collecting & Fandom, Travel & Adventure. This is the app's main taxonomy — see the naming-collision note below. |
| **Corner** | A specific craft or topic inside a Space (e.g. "Pottery" inside Crafts & Making). Some are curated (`hobbies.ts`'s `subItems`); anyone can also bring one into existence by tagging a Moment with a name that doesn't exist yet, or deliberately via "Create a Corner" on a Space page. |
| **Circle** | A joinable, topic- or location-scoped group under one hobby (`src/app/data/circles.ts`), separate from Corners and from user-made Spaces (see below). Seed data, and join/leave is local-only (`localStorage`, not mirrored to Supabase) — same local-first pattern as Pursuits, just with no remote mirror yet. |
| **Connection** | A mutual, opt-in relationship between two people — the only thing that unlocks direct messaging. Requesting doesn't grant anything; only the recipient accepting does. |
| **Participation** | The four ways to be part of something: following a hobby, joining a posted activity, or asking to "make together" / "explore together" (both require the other person to accept). |

### A naming collision worth knowing about

"Space" means two different things in this codebase, and it's confusing on
purpose only inasmuch as the product didn't invent two words for it yet:

- The **15 curated hobby Spaces** above — the app's primary browsable
  taxonomy, what `/space/:slug` (`CategoryFeed.tsx`) renders.
- **User-made Spaces** (`createSpace` in `ConnectionsContext.tsx`,
  `public.spaces` in `sql/connections.sql`) — private, invite-only or open
  groups a person creates and invites others into. Unrelated to the 15
  curated ones other than optionally citing one (`hobby_slug`) as context.

If you're extending either feature, check which "Space" a given file means
before assuming.

## Tech stack

- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4**
- **React Router v7**, using `createHashRouter` (not `BrowserRouter`) — the
  app ships as a static bundle that sometimes gets opened straight from
  `file://` or a plain static host, and hash routing works identically there
  (see the comment at the top of `src/app/routes.ts`)
- **Supabase** (Postgres + Auth + Storage) for everything that has to work
  across devices or between two different people's browsers

### The local-first / Supabase-backed split

A lot of state in this app follows the same shape: **local-first, with a
best-effort Supabase mirror.** Pursuits, private logs, saved posts, and
profile links all live in `localStorage` first (via `useSyncExternalStore`
in `src/app/lib/journal.ts` and similar), so every feature works instantly
with no account and no network — then, when signed in, a remote copy gets
written through so it's visible from another device or to other people
where the feature calls for that (e.g. a Pursuit marked shared).

Anything inherently *between two people* — connections, messages,
notifications, participations — has no local-only equivalent, since the
other person is, by definition, on a different device.

If `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` aren't set, the whole app
still runs in a fully local/demo mode: no accounts, nothing persists past
the tab, but every screen is reachable and functional.

## Getting started

```bash
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

Requires Node 18+.

Copy your own Supabase project's URL and anon/publishable key into `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

This key is meant to be public — it identifies the project, not a secret —
row-level security policies (below) are what actually protect the data.

## Database setup

Every table, policy, and trigger lives in `sql/*.sql`, meant to be run by
hand in the Supabase SQL Editor (Supabase → SQL Editor → New query → paste →
Run). Each file is idempotent (`create table if not exists`,
`drop policy if exists` before every `create policy`), so re-running one is
always safe. Run them in this order the first time:

1. `sql/social.sql` — participations, thoughts, notifications, messages, hobby follows
2. `sql/people.sql` — makes profiles publicly findable/searchable
3. `sql/fixes.sql` — correctness fixes on top of social.sql
4. `sql/connections.sql` — connections, user-made Spaces + invitations, rewrites messaging to require a connection or shared Space
5. `sql/space-fix.sql` — fixes an RLS infinite-recursion bug in connections.sql's Space policies
6. `sql/corners.sql` — Corners, tag-created with a trigger-maintained moment count
7. `sql/categories.sql` — category suggestions + admin review
8. `sql/pursuits.sql` — the write-through mirror for shared Pursuits
9. `sql/profile-links.sql` — GitHub/portfolio/Substack links on a profile
10. `sql/milestones.sql` — which Quiet Milestones someone has explicitly shared to their public profile
11. `sql/drafts.sql` — cross-device mirror of the one in-progress composer draft
12. **`sql/security-hardening.sql`** — run this last, and don't skip it

`security-hardening.sql` closes three privilege-escalation bugs that existed
in the policies above (a self-grantable admin flag, a Space invitation
bypass, and a connection-identity forgery on accept), locks down a couple of
under-restricted writes (notifications, Corner creation, the storage
bucket), and adds rate limiting on every spam-prone write via a
`SECURITY DEFINER`-gated ledger table. See the comments in that file for the
concrete scenario each fix closes — they're written to be read, not just run.

To make yourself an admin (needed for `/admin/categories`, reviewing
category suggestions), after running `categories.sql`:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

That has to be run as the SQL Editor's own role — `security-hardening.sql`
deliberately revokes the ability to set `is_admin` any other way.

## Project structure

```
src/
  app/
    routes.ts            createHashRouter route table
    pages/
      Home.tsx              landing page
      Discover.tsx          browse feed across all Spaces
      MySpace.tsx           personal dashboard: Pursuits, saved, nearby work
      CategoryFeed.tsx       one Space's page — Corners, feed, "Create a Corner"
      HobbyArchive.tsx        one hobby's archived work
      You.tsx                 your own profile/moments/Pursuits
      PublicProfile.tsx        someone else's public shelf (/u/:username)
      Log.tsx                  the create flow: Moments, Pursuits, sharing, Goals
      Inbox.tsx                notifications + participation requests
      Circles.tsx              browse/join Circles
      People.tsx               find people
      AdminCategories.tsx      review category suggestions (is_admin only)
      Shop.tsx / ProductDetail.tsx   marketplace listings
      Login.tsx
    components/            shared UI — cards, dialogs, PursuitCard, GoalDialog,
                            HobbyShelf, CreateCornerDialog, MomentDetail, ...
    components/ui/         shadcn-style primitives (button, dialog, select, ...)
    context/               ContentContext (posts/feed), AuthContext, RewardsContext,
                            ConnectionsContext (connections/Spaces/messaging),
                            SocialContext (participations/thoughts/notifications),
                            CornersContext, CategoriesContext, CartContext
    lib/
      journal.ts             local-first Pursuits/Goals/private-logs store
      profileLinks.ts / profileLinksRemote.ts
      pursuitsRemote.ts       write-through mirror for shared Pursuits
      people.ts / localData.ts
    data/                   hobbies.ts (the 15 Spaces), circles.ts, badges.ts,
                            categories.ts, posts.ts/products.ts (seed content)
  lib/supabase.ts          Supabase client + isSupabaseConfigured
  styles/                  Tailwind entry, fonts, theme tokens
sql/                       every migration — see "Database setup" above
```

## Rewards

Points and badges are local-only (`RewardsContext`, `localStorage`), not
mirrored to Supabase: +50 for posting, +2 for a like, +5 for visiting a new
Space, +10 per item checked out. Badges (`src/app/data/badges.ts`) unlock
automatically off those stats and show as a quiet, unranked strip on your
profile — never a leaderboard, and no streak mechanic.

## What's still mocked

- **Marketplace checkout** has no real payment processing — "buying"
  something awards the buyer points and nothing else.
- **Video posts** play for real (a native `<video>` element,
  `PostMedia.tsx`) once there's an actual uploaded file behind them; the
  seed/demo video posts that ship with the app have no real file to play, so
  those still show a static thumbnail with a play-button overlay
  (`ContentCard.tsx`).
- **Cover art** for anything without a real photo is procedurally generated
  (`src/app/components/GeneratedArt.tsx`) from a seed — a gradient, two soft
  blobs, and an icon — so nothing ever depends on an external image
  loading. Swap in `ImageWithFallback` + real URLs if that's no longer a
  constraint for where this is deployed.
