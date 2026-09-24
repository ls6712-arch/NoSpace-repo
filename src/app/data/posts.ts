import { CircleTabId } from "./circles";
import { getHobby, subHobbyLabel } from "./hobbies";

/**
 * Spaces Rework: the new vocabulary is `just_me | followers | space | public`.
 * `circle` and `private` stay in this union as accepted legacy values —
 * Circle-posting (CircleComposer.tsx, Log.tsx's composer, MomentCard.tsx's
 * switcher) is still fully live UI through Phase 5 of that rework and can
 * still write `circle` until Phase 6 actually removes it, so narrowing this
 * type (or the DB check constraint) before then would break real, shipped
 * functionality. `private` is the pre-rename spelling of `just_me`; existing
 * data was already migrated (see supabase/migrations/
 * 20260924100000_spaces_rework_visibility.sql), but the type stays wide
 * until every write path is updated to stop producing it.
 */
export type Visibility = "public" | "followers" | "space" | "just_me" | "circle" | "private";

export interface Post {
  id: number;
  hobbySlug: string;
  /** The specific hobby within the space, e.g. "pottery" inside "workbench" —
   * still what badges, Pursuits, and the shelf group a Moment by. */
  subHobby?: string;
  /** Which Corner (the Discover/Space browsing category — sql's `corners`
   * table) this Moment sits in, set independently of subHobby: a Moment can
   * be tagged Woodwork (subHobby) and filed under the Gift-making Corner at
   * the same time. Null on a post logged before this field existed — see
   * postCorner() below for the fallback every Corner-facing read should use. */
  corner?: string;
  /** What the post is about, in the maker's own words: "Pottery", "Bouldering". */
  interest?: string;
  /** "written" carries no real photo or video — see NewPostInput.type in
   * ContentContext.tsx for how the composer decides it. */
  type: "photo" | "video" | "written";
  /** Set only on the local-only fallback copy addPost() returns when a
   * signed-in save to Supabase actually failed (as opposed to a genuine
   * signed-out/offline post, which is also local-only but never sets this).
   * Distinguishes the two so a failed save doesn't silently earn rewards or
   * count toward share-card numbers. */
  unsaved?: boolean;
  media: string;
  /** The full ordered set of photos when this Moment carries more than one
   * (1-8; videos stay single-item). media always mirrors mediaUrls[0], for
   * anywhere that only ever reads one URL. */
  mediaUrls?: string[];
  creator: string;
  caption: string;
  /** A private reflection captured at post time — "Log, then Reflect" — never shown publicly. */
  reflection?: string;
  likes: number;
  /** Public reaction totals (posts.love_count / posts.in_count, kept in step
   * by a trigger on public.reactions). Visible to anyone who can see the
   * Moment — see supabase/migrations/20260924200000_post_reaction_counts.sql. */
  loveCount?: number;
  inCount?: number;
  createdAt: number;
  visibility: Visibility;
  /** Set when visibility === "circle" — which circle this post belongs to. */
  circleId?: number;
  /** Links this post to a sellable listing in products.ts, if the creator is selling something. */
  productId?: number;
  /** Set on real (Supabase-backed) posts — the Supabase auth user id that made this post. */
  userId?: string;
  /** Set when this moment is a thing happening at a time — a walk, a workshop. */
  startsAt?: number;
  locationName?: string;
  locationPrivacy?: "exact" | "neighborhood" | "city" | "approximate" | "hidden";
  /** When on, only the poster and each thought's author can read the thoughts. */
  thoughtsPrivate?: boolean;
  /** Set when this Moment is an update on a specific Pursuit (sql/pursuits.sql,
   * sql/pursuit-updates.sql) — what a Pursuit's own page (/pursuit/:id) filters
   * its feed by. Real posts mirror this to the database so it survives across
   * devices and is visible to anyone the Pursuit itself is shared with; the
   * local-only entryProject map in lib/journal.ts remains the fast path for
   * the owner's own browser and for posts made before this field existed. */
  pursuitId?: string;
  /** Set when visibility === "circle" — which of the board's four sections
   * this thread was filed under. See sql/circle-threads.sql. */
  circleTab?: CircleTabId;
  /** A "questions" thread the asker or the Circle's owner has marked
   * resolved. Meaningless outside the questions tab, but harmless there. */
  answered?: boolean;
  /** True unless the Circle composer's own "Also save to Moments" box was
   * checked — a Circle contribution used to always leak into the poster's
   * own public Moments shelf with no way to opt out. See
   * ContentContext.tsx's myPosts and CircleComposer.tsx. */
  hiddenFromMoments?: boolean;
  /** Open, multiple tags — what a Moment is actually about, replacing the
   * fixed Space+interest pair as the primary way to describe it (see
   * sql/open-tags.sql). hobbySlug/subHobby/interest above are kept exactly
   * as they were and still resolve for anything that reads them (Corners,
   * badges, Pursuits) — tags is the new, additive field the composer and
   * the Shelf's tag row actually read from now. Never empty for a real
   * post; legacyTags() below backfills it for seed content the same way
   * the SQL migration backfills it for existing database rows. */
  tags?: string[];
  /** Set by the owner to feature this Moment first on their Shelf — see
   * sql/post-pinning.sql. */
  pinned?: boolean;
  /** Set when this entry is actually a private log shown in the main
   * archive, not a real row in `posts`. `id` here is a negative stand-in
   * to avoid colliding with real post ids in the same list; privateLogId
   * holds the real id to use when calling private-log update/delete. */
  isPrivateLog?: boolean;
  privateLogId?: number;
}

/** Which Corner a Moment belongs to, for every Corner-facing read (Discover's
 * filter, a Space's "Follow a Corner" grid, a Corner's own page, "Explore
 * this Corner"). corner is the real field going forward; subHobby is the
 * fallback for a post logged before it existed — see supabase/migrations'
 * add_post_corner migration, which backfills corner = sub_hobby once, but
 * can't retroactively backfill a post written after that migration ran on
 * a build that predates this field. */
export function postCorner(post: Pick<Post, "corner" | "subHobby">): string | undefined {
  return post.corner ?? post.subHobby;
}

const HOUR = 3600 * 1000;
const hoursAgo = (h: number) => Date.now() - h * HOUR;

// All seed content is public — it's the platform's existing discovery feed.
// (circle- and friends-only posts only exist once a real user creates one via Creator Studio.)
const PUBLIC = "public" as const;

export const seedPosts: Post[] = [
  // Workbench
  {
    id: 101,
    hobbySlug: "crafts-making",
    subHobby: "pottery",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Mara Chen",
    caption: "Trimmed my first set of mugs tonight. Still wobbly, still proud.",
    likes: 214,
    createdAt: hoursAgo(6),
    visibility: PUBLIC,
    productId: 7,
  },
  {
    id: 102,
    hobbySlug: "crafts-making",
    subHobby: "embroidery",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1599789197514-47270cd526b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Priya Nair",
    caption: "60 seconds of hoop embroidery. This stitch took me a week to learn.",
    likes: 341,
    createdAt: hoursAgo(30),
    visibility: PUBLIC,
  },
  {
    id: 103,
    hobbySlug: "art-creative",
    subHobby: "ceramics",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1590605095243-072811dbe64c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Jonah Kim",
    caption: "Air-dry clay dish set, painted with leftover watercolors.",
    likes: 98,
    createdAt: hoursAgo(60),
    visibility: PUBLIC,
  },
  {
    id: 104,
    hobbySlug: "crafts-making",
    subHobby: "crochet",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1584992236310-6edddc08acff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Alix Torres",
    caption: "Granny square blanket, square 40 of ~120. No screens involved.",
    likes: 452,
    createdAt: hoursAgo(90),
    visibility: PUBLIC,
  },
  {
    id: 105,
    hobbySlug: "crafts-making",
    subHobby: "candle-making",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1624479163091-3c000402218d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Mara Chen",
    caption: "Pouring lavender-cedar candles for the weekend market.",
    likes: 176,
    createdAt: hoursAgo(200),
    visibility: PUBLIC,
  },

  // In Motion
  {
    id: 301,
    hobbySlug: "sports-fitness",
    subHobby: "pickleball",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Jordan Price",
    caption: "Dinking drill you can practice against any wall.",
    likes: 401,
    createdAt: hoursAgo(10),
    visibility: PUBLIC,
    productId: 19,
  },
  {
    id: 302,
    hobbySlug: "sports-fitness",
    subHobby: "padel",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1658723826297-fe4d1b1e6600?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Nate Ruiz",
    caption: "First padel session. Lost every set, had the best time.",
    likes: 122,
    createdAt: hoursAgo(55),
    visibility: PUBLIC,
  },
  {
    id: 303,
    hobbySlug: "sports-fitness",
    subHobby: "pickleball",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1618551763300-dc7eb8ce3560?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Kayla Byrne",
    caption: "Turned the cul-de-sac into a Sunday pickleball league.",
    likes: 267,
    createdAt: hoursAgo(95),
    visibility: PUBLIC,
  },
  {
    id: 304,
    hobbySlug: "sports-fitness",
    subHobby: "pickleball",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1663573690125-d326a87a2535?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Jordan Price",
    caption: "Court shoes finally arrived. My knees say thank you.",
    likes: 94,
    createdAt: hoursAgo(170),
    visibility: PUBLIC,
  },
  {
    id: 305,
    hobbySlug: "sports-fitness",
    subHobby: "pickleball",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Kayla Byrne",
    caption: "Post-match recap: we're 3-1 this season.",
    likes: 156,
    createdAt: hoursAgo(280),
    visibility: PUBLIC,
  },

  // Kitchen Table
  {
    id: 401,
    hobbySlug: "food-cooking",
    subHobby: "espresso",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Theo Reyes",
    caption: "Latte art tutorial, take 47. The rosetta finally worked.",
    likes: 512,
    createdAt: hoursAgo(8),
    visibility: PUBLIC,
    productId: 25,
  },
  {
    id: 402,
    hobbySlug: "food-cooking",
    subHobby: "espresso",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1514066558159-fc8c737ef259?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Ines Moreau",
    caption: "Cardamom rose latte > anything at the shop down the street.",
    likes: 198,
    createdAt: hoursAgo(48),
    visibility: PUBLIC,
  },
  {
    id: 403,
    hobbySlug: "food-cooking",
    subHobby: "home-coffee",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1702234683996-9271b4d8231f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Theo Reyes",
    caption: "Coffee corner finally has a home. This tray changed everything.",
    likes: 245,
    createdAt: hoursAgo(100),
    visibility: PUBLIC,
  },
  {
    id: 404,
    hobbySlug: "food-cooking",
    subHobby: "tea",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1674475760738-8c7af859f821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Bea Lindqvist",
    caption: "Third place, achieved. Blanket, book, one good mug.",
    likes: 312,
    createdAt: hoursAgo(190),
    visibility: PUBLIC,
  },
  {
    id: 405,
    hobbySlug: "food-cooking",
    subHobby: "espresso",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1577590835286-1cdd24c08fd7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Ines Moreau",
    caption: "Microfoam PSA: it's all in the wrist.",
    likes: 167,
    createdAt: hoursAgo(300),
    visibility: PUBLIC,
  },

  // Rabbit Hole
  {
    id: 501,
    hobbySlug: "books-writing",
    subHobby: "books",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1767338718786-92f7934e925e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Sam Okafor",
    caption: "Shelf reorganized by color. Don't ask how long this took.",
    likes: 289,
    createdAt: hoursAgo(12),
    visibility: PUBLIC,
    productId: 31,
  },
  {
    id: 502,
    hobbySlug: "gaming-tabletop",
    subHobby: "trading-cards",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1699898016940-ac6892b79171?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Reo Tanaka",
    caption: "Finished sleeving the whole binder. 540 slots, all full.",
    likes: 176,
    createdAt: hoursAgo(62),
    visibility: PUBLIC,
  },
  {
    id: 503,
    hobbySlug: "fashion-beauty",
    subHobby: "thrifting",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1671535108665-eeeb723ebebf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Sam Okafor",
    caption: "Visible mending a thrifted jacket: sashiko stitch walkthrough.",
    likes: 233,
    createdAt: hoursAgo(120),
    visibility: PUBLIC,
  },
  {
    id: 504,
    hobbySlug: "fashion-beauty",
    subHobby: "thrifting",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1620228389798-c685290a453a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Reo Tanaka",
    caption: "Pin collection finally has a real display case.",
    likes: 121,
    createdAt: hoursAgo(210),
    visibility: PUBLIC,
  },
  {
    id: 505,
    hobbySlug: "gaming-tabletop",
    type: "photo",
    media:
      "https://images.unsplash.com/photo-1688126753535-0ca32e3b5cbb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Bea Lindqvist",
    caption: "Made a tote from fabric scraps I couldn't bear to throw out.",
    likes: 143,
    createdAt: hoursAgo(330),
    visibility: PUBLIC,
  },
];

/** The same readable-label conversion sql/open-tags.sql applies to every
 * real database row, run once here so seed content — which predates the
 * `tags` field entirely — shows up genuinely tagged too, rather than every
 * seed Moment looking untagged next to real ones. */
function legacyTags(post: Post): string[] {
  const out = new Set<string>();
  const hobby = getHobby(post.hobbySlug);
  if (hobby) out.add(hobby.name);
  if (post.subHobby) {
    const label = subHobbyLabel(post.subHobby);
    if (label) out.add(label);
  }
  if (post.interest?.trim()) out.add(post.interest.trim());
  return [...out];
}

for (const post of seedPosts) {
  if (!post.tags || post.tags.length === 0) post.tags = legacyTags(post);
}
