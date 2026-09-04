export type Visibility = "public" | "circle" | "friends";

export interface Post {
  id: number;
  hobbySlug: string;
  /** The specific hobby within the space, e.g. "pottery" inside "workbench". */
  subHobby?: string;
  type: "photo" | "video";
  media: string;
  creator: string;
  caption: string;
  /** A private reflection captured at post time — "Log, then Reflect" — never shown publicly. */
  reflection?: string;
  likes: number;
  createdAt: number;
  visibility: Visibility;
  /** Set when visibility === "circle" — which circle this post belongs to. */
  circleId?: number;
  /** Links this post to a sellable listing in products.ts, if the creator is selling something. */
  productId?: number;
  /** Set on real (Supabase-backed) posts — the Supabase auth user id that made this post. */
  userId?: string;
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
    hobbySlug: "workbench",
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
    hobbySlug: "workbench",
    subHobby: "embroidery",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1599789197514-47270cd526b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Priya Nair",
    caption: "60 seconds of hoop embroidery — this stitch took me a week to learn.",
    likes: 341,
    createdAt: hoursAgo(30),
    visibility: PUBLIC,
  },
  {
    id: 103,
    hobbySlug: "workbench",
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
    hobbySlug: "workbench",
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
    hobbySlug: "workbench",
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
    hobbySlug: "inmotion",
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
    hobbySlug: "inmotion",
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
    hobbySlug: "inmotion",
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
    hobbySlug: "inmotion",
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
    hobbySlug: "inmotion",
    subHobby: "pickleball",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Kayla Byrne",
    caption: "Post-match recap — we're 3-1 this season.",
    likes: 156,
    createdAt: hoursAgo(280),
    visibility: PUBLIC,
  },

  // Kitchen Table
  {
    id: 401,
    hobbySlug: "kitchentable",
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
    hobbySlug: "kitchentable",
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
    hobbySlug: "kitchentable",
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
    hobbySlug: "kitchentable",
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
    hobbySlug: "kitchentable",
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
    hobbySlug: "rabbithole",
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
    hobbySlug: "rabbithole",
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
    hobbySlug: "rabbithole",
    subHobby: "thrifting",
    type: "video",
    media:
      "https://images.unsplash.com/photo-1671535108665-eeeb723ebebf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    creator: "Sam Okafor",
    caption: "Visible mending a thrifted jacket — sashiko stitch walkthrough.",
    likes: 233,
    createdAt: hoursAgo(120),
    visibility: PUBLIC,
  },
  {
    id: 504,
    hobbySlug: "rabbithole",
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
    hobbySlug: "rabbithole",
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
