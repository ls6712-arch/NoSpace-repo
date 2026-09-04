export interface RewardStats {
  points: number;
  /** Every logged session, newest last — one entry per post, holding the hobby it was in. */
  postsCreated: number;
  likesGiven: number;
  purchases: number;
  hobbiesVisited: string[];
  /**
   * One entry per logged session, holding that session's hobby (sub-hobby slug
   * where tagged, otherwise `space:<slug>`). Length equals postsCreated; the
   * most frequent entry is the primary hobby.
   */
  hobbiesPosted: string[];
}

export interface Badge {
  id: string;
  /** Generic name. Craft-specific badges override this per hobby — see badgeName(). */
  name: string;
  description: string;
  icon: string; // lucide icon name, resolved in the UI
  test: (stats: RewardStats) => boolean;
}

/** How many sessions you've logged in whichever hobby you log most. */
export function primaryHobbySessions(stats: RewardStats): number {
  if (stats.hobbiesPosted.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const key of stats.hobbiesPosted) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(...counts.values());
}

/**
 * Milestones tied to what you've actually made, not to platform tenure or how
 * often you show up. "Sessions" are logged posts — in this app, one post is one
 * time you sat down and did the thing.
 *
 * Two of these are craft-specific and get renamed per hobby (see CRAFT_NAMES):
 * "First Piece Fired" and "Master Potter" only make sense for pottery, so they
 * carry generic names here and are resolved against your primary hobby at
 * render time. Badge *ids* stay global and stable, so unlock state survives a
 * change of primary hobby — only the wording follows the craft.
 */
export const badges: Badge[] = [
  {
    id: "first-spark",
    name: "First Spark",
    description: "Logged your first session.",
    icon: "Sparkles",
    test: (s) => s.postsCreated >= 1,
  },
  {
    id: "sessions-10",
    name: "10 Sessions",
    description: "Logged 10 sessions. It's a habit now.",
    icon: "Flame",
    test: (s) => s.postsCreated >= 10,
  },
  {
    id: "first-output",
    name: "First Finished Piece",
    description: "15 sessions in one hobby — long enough to finish something real.",
    icon: "Award",
    test: (s) => primaryHobbySessions(s) >= 15,
  },
  {
    id: "sessions-50",
    name: "50 Sessions",
    description: "Logged 50 sessions.",
    icon: "Repeat",
    test: (s) => s.postsCreated >= 50,
  },
  {
    id: "skill-explorer",
    name: "Skill Explorer",
    description: "Logged sessions in 3 different hobbies.",
    icon: "Compass",
    test: (s) => new Set(s.hobbiesPosted).size >= 3,
  },
  {
    id: "sessions-100",
    name: "100 Sessions",
    description: "Logged 100 sessions.",
    icon: "Mountain",
    test: (s) => s.postsCreated >= 100,
  },
  {
    id: "mastery",
    name: "Mastery",
    description: "150 sessions in a single hobby.",
    icon: "Crown",
    test: (s) => primaryHobbySessions(s) >= 150,
  },
];

/** Badges whose wording depends on the craft rather than the platform. */
const CRAFT_BADGE_IDS = new Set(["first-output", "mastery"]);

/**
 * Per-hobby wording for the two craft badges: [first finished piece, mastery].
 * Anything not listed falls back to the generic pair, so this table can stay
 * short and grow only where a hobby has a name worth using.
 */
const CRAFT_NAMES: Record<string, [string, string]> = {
  pottery: ["First Piece Fired", "Master Potter"],
  ceramics: ["First Piece Fired", "Master Ceramicist"],
  knitting: ["First Finished Knit", "Master Knitter"],
  crochet: ["First Finished Piece", "Master Crocheter"],
  embroidery: ["First Hoop Finished", "Master Embroiderer"],
  sewing: ["First Garment Finished", "Master Tailor"],
  woodworking: ["First Build Finished", "Master Woodworker"],
  "jewelry-making": ["First Piece Set", "Master Jeweller"],
  "candle-making": ["First Clean Pour", "Master Chandler"],
  "3d-printing": ["First Clean Print", "Master Fabricator"],
  electronics: ["First Working Circuit", "Master Tinkerer"],
  robotics: ["First Robot Walking", "Master Roboticist"],
  coding: ["First Thing Shipped", "Master Builder"],
  "game-development": ["First Playable Build", "Master Game Dev"],
  running: ["First Long Run Logged", "Master Runner"],
  yoga: ["First Held Pose", "Master Yogi"],
  climbing: ["First Route Sent", "Master Climber"],
  pickleball: ["First Match Won", "Master of the Court"],
  cooking: ["First Dish Nailed", "Master Cook"],
  baking: ["First Perfect Bake", "Master Baker"],
  sourdough: ["First Perfect Loaf", "Master Baker"],
  espresso: ["First Clean Pour", "Master Barista"],
  "home-coffee": ["First Clean Pour", "Master Barista"],
  gardening: ["First Harvest", "Master Gardener"],
  houseplants: ["First Plant Thriving", "Master Grower"],
  foraging: ["First Full Basket", "Master Forager"],
  painting: ["First Canvas Finished", "Master Painter"],
  drawing: ["First Piece Finished", "Master Draughtsman"],
  watercolor: ["First Wash Finished", "Master Watercolourist"],
  photography: ["First Roll Finished", "Master Photographer"],
  "music-production": ["First Track Finished", "Master Producer"],
  instrument: ["First Piece Played Through", "Master Musician"],
  writing: ["First Draft Finished", "Master Writer"],
  calligraphy: ["First Page Finished", "Master Calligrapher"],
  chess: ["First Game Won", "Master of the Board"],
  "board-games": ["First Game Won", "Master Strategist"],
  lego: ["First Build Finished", "Master Builder"],
  puzzles: ["First Puzzle Finished", "Master Solver"],
};

/**
 * The name to show for a badge, given the hobby someone is furthest into.
 * `hobbySlug` is a sub-hobby slug (e.g. "pottery"); pass the label too so an
 * unlisted hobby still reads naturally ("Master of Pilates").
 */
export function badgeName(badge: Badge, hobbySlug?: string, hobbyLabel?: string): string {
  if (!CRAFT_BADGE_IDS.has(badge.id) || !hobbySlug) return badge.name;

  const named = CRAFT_NAMES[hobbySlug];
  if (named) return badge.id === "mastery" ? named[1] : named[0];

  if (badge.id === "mastery" && hobbyLabel) return `Master of ${hobbyLabel}`;
  return badge.name;
}

export function levelForPoints(points: number) {
  return Math.floor(points / 200) + 1;
}

export function levelProgress(points: number) {
  const into = points % 200;
  return Math.round((into / 200) * 100);
}
