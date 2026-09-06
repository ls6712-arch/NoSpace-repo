/**
 * A single hobby inside a Space — "Pottery" inside Crafts & Making. These are
 * what people actually do; the Spaces above them are the shelves they sit on.
 * Each one can filter a Space's feed, and each keeps the slug it already had,
 * so nothing stored on an existing post stops resolving.
 */
export interface SubHobby {
  slug: string;
  label: string;
}

/**
 * Builds a SubHobby, deriving a URL-safe slug from the label unless one is
 * given explicitly (needed where the label has accents or is a mouthful).
 */
const sub = (label: string, slug?: string): SubHobby => ({
  label,
  slug:
    slug ??
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
});

export interface Hobby {
  slug: string;
  /** Full Space name, e.g. "Crafts & Making". */
  name: string;
  /** Short label for nav/cards. Same as the name — these are plain already. */
  shortName: string;
  tagline: string;
  /** Plain-language description of the Space, shown under the name. */
  plainLabel: string;
  description: string;
  /** The specific hobbies/activities that live inside this Space. */
  subItems: SubHobby[];
  gradient: string; // tailwind gradient classes
  coverImage: string;
  /** Demo/placeholder figure — like the rest of this prototype's numbers, not real data. */
  creatorCount: string;
}

/**
 * The Spaces.
 *
 * These used to be eight invented names — Workbench, Rabbit Hole, Rooted &
 * Wild. They read well and meant nothing to anyone arriving for the first
 * time, so they are now the fifteen plainly-named categories. A Space is
 * both the shelf and the signpost; there is no second taxonomy sitting over
 * the top of it.
 *
 * Every sub-hobby keeps the slug it already had. A post that stored
 * sub_hobby "pottery" still resolves to Pottery, still shows its label, and
 * still filters correctly — it simply sits under Crafts & Making now instead
 * of The Workbench.
 */
export const hobbies: Hobby[] = [
  {
    slug: "food-cooking",
    name: "Food & Cooking",
    shortName: "Food & Cooking",
    tagline: "Made in the kitchen.",
    plainLabel: "Cooking, baking, coffee, bread, fermentation, BBQ",
    description: "Cooking, baking, coffee, bread, fermentation, BBQ.",
    subItems: [
      sub("Cooking"), sub("Baking"), sub("Sourdough"), sub("Fermentation"),
      sub("Home coffee"), sub("Tea"), sub("Espresso"), sub("Food photography"),
      sub("Home brewing"), sub("Kombucha"), sub("Cocktail-making"), sub("Supper clubs"),
      sub("Coffee"), sub("BBQ"),
    ],
    gradient: "from-[var(--coral-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "sports-fitness",
    name: "Sports & Fitness",
    shortName: "Sports & Fitness",
    tagline: "Moving, and getting better at it.",
    plainLabel: "Running, gym, cycling, climbing, tennis, swimming",
    description: "Running, gym, cycling, climbing, tennis, swimming.",
    subItems: [
      sub("Running"), sub("Run clubs"), sub("Climbing"), sub("Cycling"),
      sub("Dance"), sub("Pickleball"), sub("Padel"), sub("Tennis"),
      sub("Swimming"), sub("Martial arts"), sub("Strength training"), sub("Basketball"),
      sub("Soccer"), sub("Volleyball"),
    ],
    gradient: "from-[var(--sky-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "art-creative",
    name: "Art & Creative",
    shortName: "Art & Creative",
    tagline: "Made by hand and eye.",
    plainLabel: "Drawing, painting, illustration, ceramics, sculpture",
    description: "Drawing, painting, illustration, ceramics, sculpture.",
    subItems: [
      sub("Ceramics"), sub("Painting"), sub("Drawing"), sub("Watercolor"),
      sub("Calligraphy"), sub("Theater"), sub("Illustration"), sub("Sculpture"),
    ],
    gradient: "from-[var(--yellow)] to-[var(--coral-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "crafts-making",
    name: "Crafts & Making",
    shortName: "Crafts & Making",
    tagline: "Made it yourself.",
    plainLabel: "Sewing, knitting, crochet, pottery, woodworking, jewelry",
    description: "Sewing, knitting, crochet, pottery, woodworking, jewelry.",
    subItems: [
      sub("Pottery"), sub("Knitting"), sub("Crochet"), sub("Embroidery"),
      sub("Sewing"), sub("Woodworking"), sub("Jewelry-making"), sub("Candle-making"),
      sub("Soap-making"), sub("Upcycling"), sub("Paper crafts"), sub("Zines"),
      sub("Scrapbooking"), sub("Model-making"), sub("Miniatures"), sub("Makerspaces"),
    ],
    gradient: "from-[var(--forest)] to-[var(--sky-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "books-writing",
    name: "Books & Writing",
    shortName: "Books & Writing",
    tagline: "Words, read and written.",
    plainLabel: "Reading, book clubs, poetry, journaling, creative writing",
    description: "Reading, book clubs, poetry, journaling, creative writing.",
    subItems: [
      sub("Nature journaling"), sub("Writing"), sub("Poetry"), sub("Journaling"),
      sub("Books"), sub("Book clubs"), sub("Language learning"), sub("Reading"),
      sub("Creative writing"),
    ],
    gradient: "from-[var(--coral-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "nature-outdoors",
    name: "Nature & Outdoors",
    shortName: "Nature & Outdoors",
    tagline: "Out where the weather is.",
    plainLabel: "Hiking, camping, birding, fishing, foraging, gardening",
    description: "Hiking, camping, birding, fishing, foraging, gardening.",
    subItems: [
      sub("Hiking"), sub("Birdwatching"), sub("Foraging"), sub("Camping"),
      sub("Fishing"), sub("Outdoor photography"), sub("Nature journaling"),
    ],
    gradient: "from-[var(--sky-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "home-garden",
    name: "Home & Garden",
    shortName: "Home & Garden",
    tagline: "The place you live in.",
    plainLabel: "Gardening, plants, interior design, DIY, restoration",
    description: "Gardening, plants, interior design, DIY, restoration.",
    subItems: [
      sub("Furniture flipping"), sub("Restoration"), sub("Gardening"), sub("Houseplants"),
      sub("Vegetable gardens"), sub("Native plants"), sub("Composting"), sub("Indoor growing"),
      sub("Interior design"), sub("DIY"),
    ],
    gradient: "from-[var(--yellow)] to-[var(--coral-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "gaming-tabletop",
    name: "Gaming & Tabletop",
    shortName: "Gaming & Tabletop",
    tagline: "Around a table, or a screen.",
    plainLabel: "Video games, board games, D&D, cards, puzzles, RPGs",
    description: "Video games, board games, D&D, cards, puzzles, RPGs.",
    subItems: [
      sub("Board games"), sub("Chess"), sub("Tabletop RPGs"), sub("Trading cards"),
      sub("Puzzles"), sub("D&D"), sub("Video games"),
    ],
    gradient: "from-[var(--forest)] to-[var(--sky-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "music",
    name: "Music",
    shortName: "Music",
    tagline: "Played, sung, and made.",
    plainLabel: "Instruments, singing, songwriting, DJing, music production",
    description: "Instruments, singing, songwriting, DJing, music production.",
    subItems: [
      sub("Music production"), sub("Singing"), sub("Guitar"), sub("Songwriting"),
      sub("DJing"),
    ],
    gradient: "from-[var(--coral-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "photography-film",
    name: "Photography & Film",
    shortName: "Photography & Film",
    tagline: "Looking, and keeping it.",
    plainLabel: "Photography, film photography, filmmaking, video",
    description: "Photography, film photography, filmmaking, video.",
    subItems: [
      sub("Food photography"), sub("Outdoor photography"), sub("Photography"), sub("Filmmaking"),
      sub("Film photography"), sub("Video"),
    ],
    gradient: "from-[var(--sky-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "health-wellness",
    name: "Health & Wellness",
    shortName: "Health & Wellness",
    tagline: "Looking after yourself.",
    plainLabel: "Yoga, Pilates, meditation, mindfulness, breathwork",
    description: "Yoga, Pilates, meditation, mindfulness, breathwork.",
    subItems: [
      sub("Yoga"), sub("Pilates"), sub("Meditation"), sub("Mindfulness"),
      sub("Breathwork"),
    ],
    gradient: "from-[var(--yellow)] to-[var(--coral-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "fashion-beauty",
    name: "Fashion & Beauty",
    shortName: "Fashion & Beauty",
    tagline: "What you wear and how.",
    plainLabel: "Fashion, styling, thrifting, makeup, nails, fragrance",
    description: "Fashion, styling, thrifting, makeup, nails, fragrance.",
    subItems: [
      sub("Sneakers"), sub("Fashion"), sub("Thrifting"), sub("Makeup"),
      sub("Nails"), sub("Fragrance"),
    ],
    gradient: "from-[var(--forest)] to-[var(--sky-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "tech-building",
    name: "Tech & Building",
    shortName: "Tech & Building",
    tagline: "Built, wired, and shipped.",
    plainLabel: "Coding, electronics, robotics, 3D printing, AI projects",
    description: "Coding, electronics, robotics, 3D printing, AI projects.",
    subItems: [
      sub("3D printing"), sub("CAD"), sub("Laser cutting"), sub("CNC"),
      sub("Electronics"), sub("Arduino"), sub("Raspberry Pi"), sub("Robotics"),
      sub("Drones"), sub("Product prototyping"), sub("Coding"), sub("No-code building"),
      sub("Creative coding"), sub("Web design"), sub("Game development"), sub("Data visualization"),
      sub("AR/VR projects"), sub("Smart-home projects"), sub("Cybersecurity learning"), sub("AI projects"),
    ],
    gradient: "from-[var(--coral-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1553406830-ef2513450d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "collecting-fandom",
    name: "Collecting & Fandom",
    shortName: "Collecting & Fandom",
    tagline: "The things you keep.",
    plainLabel: "Vinyl, cards, books, antiques, toys, memorabilia, anime",
    description: "Vinyl, cards, books, antiques, toys, memorabilia, anime.",
    subItems: [
      sub("Trading cards"), sub("LEGO"), sub("Vinyl"), sub("Antiques"),
      sub("Toys"), sub("Anime"),
    ],
    gradient: "from-[var(--sky-deep)] to-[var(--forest)]",
    coverImage:
      "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
  {
    slug: "travel-adventure",
    name: "Travel & Adventure",
    shortName: "Travel & Adventure",
    tagline: "Going somewhere.",
    plainLabel: "Travel, road trips, backpacking, skiing, exploration",
    description: "Travel, road trips, backpacking, skiing, exploration.",
    subItems: [
      sub("Travel"), sub("Road trips"), sub("Backpacking"), sub("Skiing"),
      sub("Exploration"),
    ],
    gradient: "from-[var(--yellow)] to-[var(--coral-deep)]",
    coverImage:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "—",
  },
];

/**
 * The eight original Space slugs, and where their content lives now.
 *
 * Posts, Circles and saved links created before this change still carry these
 * in the database. Nothing was migrated — the map means nothing had to be,
 * and an old bookmark still lands somewhere sensible.
 */
export const LEGACY_SPACES: Record<string, string> = {
  workbench: "crafts-making",
  makerlab: "tech-building",
  buildstack: "tech-building",
  inmotion: "sports-fitness",
  kitchentable: "food-cooking",
  rooted: "nature-outdoors",
  thestudio: "art-creative",
  rabbithole: "gaming-tabletop",
};

/** Resolves a Space by slug, including the eight names it used to have. */
export function getHobby(slug: string) {
  return (
    hobbies.find((h) => h.slug === slug) ??
    hobbies.find((h) => h.slug === LEGACY_SPACES[slug])
  );
}

/** The current slug for a Space, translating an old one where needed. */
export function currentSpaceSlug(slug: string) {
  return LEGACY_SPACES[slug] ?? slug;
}

/** Every sub-hobby across every Space, each tagged with the Space it lives in. */
export const allSubHobbies: (SubHobby & { hobbySlug: string })[] = hobbies.flatMap(
  (h) => h.subItems.map((s) => ({ ...s, hobbySlug: h.slug })),
);

export function getSubHobby(hobbySlug: string, subSlug: string) {
  return getHobby(hobbySlug)?.subItems.find((s) => s.slug === subSlug);
}

/** Human-readable label for a sub-hobby slug, searching every Space. */
export function subHobbyLabel(subSlug: string) {
  return allSubHobbies.find((s) => s.slug === subSlug)?.label;
}
