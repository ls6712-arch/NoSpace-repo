import { hobbies } from "./hobbies";

/**
 * The fifteen things people are here to do.
 *
 * These are discovery categories — a way into the app, not a form to fill in.
 * Nothing about creating a post depends on them: you type whatever your hobby
 * is, and this file works out where it belongs afterwards. If it belongs
 * nowhere yet, that is a gap in this list rather than a mistake by the person,
 * which is what "Suggest a category" is for.
 *
 * Names are deliberately plain. The eight Spaces have characterful names —
 * Workbench, Rooted & Wild — and those stay, because a Space is a place you
 * spend time in. A category is signage: it has one job, which is to be
 * understood instantly by someone who has never been here.
 */
export interface Category {
  slug: string;
  name: string;
  /** One line, shown under the name. */
  description: string;
  /** The examples in the person's own vocabulary, not ours. */
  examples: string[];
  /**
   * What lands here. Matched case-insensitively against a post's free-text
   * interest and against the app's own sub-hobby labels, so existing content
   * files itself without anyone re-tagging anything.
   */
  keywords: string[];
  tint: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: "food-cooking",
    name: "Food & Cooking",
    description: "Cooking, baking, coffee, bread, fermentation, BBQ",
    examples: ["Cooking", "Baking", "Sourdough", "Coffee", "Fermentation", "BBQ"],
    keywords: [
      "cooking", "baking", "sourdough", "bread", "fermentation", "bbq", "barbecue",
      "grilling", "home coffee", "coffee", "espresso", "tea", "home brewing",
      "brewing", "kombucha", "cocktail", "cocktail-making", "supper clubs",
      "food photography", "pasta", "pastry", "cheese", "canning", "pickling",
      "meal prep", "vegan cooking", "baking bread",
    ],
    tint: "var(--pastel-clay)",
  },
  {
    slug: "sports-fitness",
    name: "Sports & Fitness",
    description: "Running, gym, cycling, climbing, tennis, swimming",
    examples: ["Running", "Climbing", "Cycling", "Tennis", "Swimming", "Strength training"],
    keywords: [
      "running", "run clubs", "gym", "cycling", "climbing", "bouldering", "tennis",
      "swimming", "strength training", "weightlifting", "martial arts", "boxing",
      "basketball", "soccer", "football", "volleyball", "pickleball", "padel",
      "dance", "rowing", "triathlon", "marathon", "crossfit", "skateboarding",
      "surfing", "golf", "cricket", "badminton",
    ],
    tint: "var(--pastel-sky)",
  },
  {
    slug: "art-creative",
    name: "Art & Creative",
    description: "Drawing, painting, illustration, ceramics, sculpture",
    examples: ["Drawing", "Painting", "Illustration", "Ceramics", "Sculpture"],
    keywords: [
      "drawing", "painting", "illustration", "ceramics", "sculpture", "watercolor",
      "calligraphy", "theater", "printmaking", "collage", "animation", "comics",
      "sketching", "digital art", "portrait", "life drawing", "graphic design",
    ],
    tint: "var(--pastel-rose)",
  },
  {
    slug: "crafts-making",
    name: "Crafts & Making",
    description: "Sewing, knitting, crochet, pottery, woodworking, jewelry",
    examples: ["Pottery", "Knitting", "Sewing", "Woodworking", "Jewelry-making"],
    keywords: [
      "sewing", "knitting", "crochet", "pottery", "woodworking", "jewelry",
      "jewelry-making", "embroidery", "quilting", "weaving", "candle-making",
      "soap-making", "paper crafts", "zines", "scrapbooking", "bookbinding",
      "model-making", "miniatures", "makerspaces", "leatherwork", "macrame",
      "upcycling", "resin", "glassblowing",
    ],
    tint: "var(--pastel-sage)",
  },
  {
    slug: "books-writing",
    name: "Books & Writing",
    description: "Reading, book clubs, poetry, journaling, creative writing",
    examples: ["Reading", "Book clubs", "Poetry", "Journaling", "Creative writing"],
    keywords: [
      "reading", "books", "book clubs", "poetry", "journaling", "creative writing",
      "writing", "fiction", "essays", "screenwriting", "blogging", "language learning",
      "storytelling", "zine writing", "literature",
    ],
    tint: "var(--pastel-wheat)",
  },
  {
    slug: "nature-outdoors",
    name: "Nature & Outdoors",
    description: "Hiking, camping, birding, fishing, foraging, gardening",
    examples: ["Hiking", "Camping", "Birdwatching", "Fishing", "Foraging"],
    keywords: [
      "hiking", "camping", "birding", "birdwatching", "fishing", "foraging",
      "outdoor photography", "nature journaling", "wild swimming", "kayaking",
      "canoeing", "trail running", "mushroom hunting", "stargazing", "rockpooling",
      "walking", "mountaineering",
    ],
    tint: "var(--pastel-sage)",
  },
  {
    slug: "home-garden",
    name: "Home & Garden",
    description: "Gardening, plants, interior design, DIY, restoration",
    examples: ["Gardening", "Houseplants", "Interior design", "DIY", "Restoration"],
    keywords: [
      "gardening", "plants", "houseplants", "vegetable gardens", "native plants",
      "composting", "indoor growing", "interior design", "diy", "restoration",
      "furniture flipping", "home renovation", "decorating", "bonsai", "propagation",
      "allotment",
    ],
    tint: "var(--pastel-sage)",
  },
  {
    slug: "gaming-tabletop",
    name: "Gaming & Tabletop",
    description: "Video games, board games, D&D, cards, puzzles, RPGs",
    examples: ["Board games", "D&D", "Video games", "Chess", "Puzzles"],
    keywords: [
      "video games", "gaming", "board games", "d&d", "dungeons and dragons",
      "tabletop rpgs", "rpgs", "cards", "playing cards", "puzzles", "chess",
      "warhammer", "speedrunning", "game nights", "jigsaw",
    ],
    tint: "var(--pastel-stone)",
  },
  {
    slug: "music",
    name: "Music",
    description: "Instruments, singing, songwriting, DJing, music production",
    examples: ["Guitar", "Singing", "Songwriting", "DJing", "Music production"],
    keywords: [
      "music", "music production", "singing", "songwriting", "djing", "dj",
      "guitar", "piano", "drums", "bass", "violin", "ukulele", "choir", "band",
      "producing", "synths", "recording",
    ],
    tint: "var(--pastel-rose)",
  },
  {
    slug: "photography-film",
    name: "Photography & Film",
    description: "Photography, film photography, filmmaking, video",
    examples: ["Photography", "Film photography", "Filmmaking", "Video"],
    keywords: [
      "photography", "film photography", "filmmaking", "video", "cinematography",
      "darkroom", "street photography", "portrait photography", "food photography",
      "outdoor photography", "editing", "documentary",
    ],
    tint: "var(--pastel-stone)",
  },
  {
    slug: "health-wellness",
    name: "Health & Wellness",
    description: "Yoga, Pilates, meditation, mindfulness, breathwork",
    examples: ["Yoga", "Pilates", "Meditation", "Mindfulness", "Breathwork"],
    keywords: [
      "yoga", "pilates", "meditation", "mindfulness", "breathwork", "stretching",
      "mobility", "sleep", "journalling for wellbeing", "tai chi", "qigong",
    ],
    tint: "var(--pastel-sage)",
  },
  {
    slug: "fashion-beauty",
    name: "Fashion & Beauty",
    description: "Fashion, styling, thrifting, makeup, nails, fragrance",
    examples: ["Fashion", "Thrifting", "Makeup", "Nails", "Fragrance"],
    keywords: [
      "fashion", "styling", "thrifting", "makeup", "nails", "fragrance", "perfume",
      "sneakers", "vintage clothing", "tailoring", "skincare", "hair",
    ],
    tint: "var(--pastel-rose)",
  },
  {
    slug: "tech-building",
    name: "Tech & Building",
    description: "Coding, electronics, robotics, 3D printing, AI projects",
    examples: ["Coding", "Electronics", "Robotics", "3D printing", "AI projects"],
    keywords: [
      "coding", "programming", "electronics", "robotics", "3d printing", "ai",
      "ai projects", "no-code building", "creative coding", "web design",
      "game development", "data visualization", "ar/vr projects", "smart-home projects",
      "cybersecurity learning", "cad", "laser cutting", "cnc", "arduino",
      "raspberry pi", "drones", "product prototyping", "home lab", "self-hosting",
    ],
    tint: "var(--pastel-sky)",
  },
  {
    slug: "collecting-fandom",
    name: "Collecting & Fandom",
    description: "Vinyl, cards, books, antiques, toys, memorabilia, anime",
    examples: ["Vinyl", "Trading cards", "Antiques", "Toys", "Anime"],
    keywords: [
      "collecting", "vinyl", "records", "trading cards", "antiques", "toys",
      "memorabilia", "anime", "manga", "lego", "stamps", "coins", "figures",
      "model trains", "fandom", "cosplay",
    ],
    tint: "var(--pastel-wheat)",
  },
  {
    slug: "travel-adventure",
    name: "Travel & Adventure",
    description: "Travel, road trips, backpacking, skiing, exploration",
    examples: ["Travel", "Road trips", "Backpacking", "Skiing", "Exploration"],
    keywords: [
      "travel", "road trips", "backpacking", "skiing", "snowboarding", "exploration",
      "van life", "cycling tours", "sailing", "diving", "urban exploration",
    ],
    tint: "var(--pastel-sky)",
  },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

/**
 * Whole-word matching, in one direction only.
 *
 * Substring matching looked fine and was quietly wrong: "ai" sits inside
 * "cocktail", "rowing" inside "growing", so cocktail-making filed itself
 * under Tech and houseplants under Sports. And matching the other way —
 * keyword contains label — put plain "Photography" under Food, because one
 * of Food's keywords is "food photography". A label matches a keyword when
 * it IS that keyword, or contains it as whole words.
 */
function mentions(label: string, keyword: string) {
  if (label === keyword) return true;
  if (keyword.length < 4) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escaped}( |$)`).test(label);
}

/**
 * Which categories a hobby belongs to.
 *
 * A hobby can sit in more than one — food photography is genuinely both food
 * and photography — so this returns every match rather than forcing a winner.
 * Returns an empty array for something nobody has categorised yet, which is
 * not a failure: the post still exists, still appears under its own interest,
 * and still turns up in search.
 */
export function categoriesFor(label?: string): Category[] {
  if (!label) return [];
  const q = normalise(label);
  if (!q) return [];
  return CATEGORIES.filter((c) => c.keywords.some((k) => mentions(q, normalise(k))));
}

/** The first category a hobby belongs to, for places that can only show one. */
export function primaryCategory(label?: string): Category | undefined {
  return categoriesFor(label)[0];
}

/**
 * Every category one of the app's eight Spaces feeds into, worked out from
 * the sub-hobbies inside it. This is what lets existing posts appear under
 * the new categories without anybody editing a single one.
 */
export function categoriesForSpace(hobbySlug: string): Category[] {
  const space = hobbies.find((h) => h.slug === hobbySlug);
  if (!space) return [];
  const found = new Map<string, Category>();
  for (const sub of space.subItems) {
    for (const c of categoriesFor(sub.label)) found.set(c.slug, c);
  }
  return [...found.values()];
}

/**
 * Does this post belong in this category? Checks what the maker typed first,
 * then the sub-hobby, then the Space it went into — widest net last, so a
 * post with a specific interest is filed by that rather than by its Space.
 */
export function postInCategory(
  post: { interest?: string; subHobby?: string; hobbySlug: string },
  categorySlug: string,
  subHobbyLabel: (slug: string) => string | undefined,
): boolean {
  if (post.interest && categoriesFor(post.interest).some((c) => c.slug === categorySlug)) {
    return true;
  }
  const subLabel = post.subHobby ? subHobbyLabel(post.subHobby) : undefined;
  if (subLabel && categoriesFor(subLabel).some((c) => c.slug === categorySlug)) return true;
  return false;
}
