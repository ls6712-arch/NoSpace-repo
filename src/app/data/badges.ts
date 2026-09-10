export interface RewardStats {
  points: number;
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
  /** Generic name. Craft-flavoured milestones override this — see badgeName(). */
  name: string;
  description: string;
  icon: string; // lucide icon name, resolved in the UI
  /** Soft pastel used for the badge ring — see --pastel-* in theme.css. */
  tint: string;
  test: (stats: RewardStats) => boolean;
}

/**
 * Quiet milestones. Named for what the time felt like, not for what rank it
 * earns — "Clay in My Hands", not "Level 4". Nothing here ranks you against
 * anyone else, and nothing counts followers or likes: every one of these is
 * about showing up and making something.
 *
 * Every test reads `postsCreated` — the user's real, global count of logged
 * Moments (private logs included, not just ones they chose to share) —
 * rather than sessions in any one hobby. Per-hobby progress is a separate,
 * narrower feature (see the Pursuit goal-tracking work); a quiet milestone is
 * about the whole of what you've made, regardless of which hobby or Corner
 * it landed in.
 *
 * Two of them take on the wording of whatever craft you're deepest in (see
 * CRAFT_NAMES) — that's cosmetic only. Badge *ids* stay global and stable so
 * unlock state survives a change of primary hobby.
 */
export const badges: Badge[] = [
  {
    id: "first-session",
    name: "First Session",
    description: "You showed up once. That's the hard one.",
    icon: "Sprout",
    tint: "var(--pastel-sage)",
    test: (s) => s.postsCreated >= 1,
  },
  {
    id: "hands-on",
    name: "Getting My Hands In",
    description: "Ten Moments logged. Past the beginner wobble.",
    icon: "Hand",
    tint: "var(--pastel-clay)",
    test: (s) => s.postsCreated >= 10,
  },
  {
    id: "made-something",
    name: "Made Something",
    description: "Fifteen Moments logged. Long enough to finish a real thing.",
    icon: "Package",
    tint: "var(--pastel-wheat)",
    test: (s) => s.postsCreated >= 15,
  },
  {
    id: "curious-hands",
    name: "Curious Hands",
    description: "Moments logged across three different hobbies.",
    icon: "Compass",
    tint: "var(--pastel-stone)",
    test: (s) => new Set(s.hobbiesPosted).size >= 3,
  },
  {
    id: "consistency-club",
    name: "Consistency Club",
    description: "Fifty Moments. You keep coming back.",
    icon: "Coffee",
    tint: "var(--pastel-sky)",
    test: (s) => s.postsCreated >= 50,
  },
  {
    id: "still-going",
    name: "Still Going",
    description: "A hundred Moments in. Quietly remarkable.",
    icon: "Mountain",
    tint: "var(--pastel-rose)",
    test: (s) => s.postsCreated >= 100,
  },
  {
    id: "second-nature",
    name: "Second Nature",
    description: "A hundred and fifty Moments in. It's part of you now.",
    icon: "Feather",
    tint: "var(--pastel-sage)",
    test: (s) => s.postsCreated >= 150,
  },
];

/** Milestones whose wording follows the craft rather than the platform. */
const CRAFT_BADGE_IDS = new Set(["hands-on", "second-nature"]);

/**
 * Per-hobby wording: [ten sessions in, deeply settled in].
 * Anything not listed falls back to the generic pair, so this table can stay
 * short and grow only where a hobby has a phrase worth using.
 */
const CRAFT_NAMES: Record<string, [string, string]> = {
  pottery: ["Clay in My Hands", "At Home in Clay"],
  ceramics: ["Clay in My Hands", "At Home in Clay"],
  knitting: ["Rhythm in the Needles", "Knitting Without Looking"],
  crochet: ["Rhythm in the Hook", "Crocheting Without Looking"],
  embroidery: ["Steady Stitches", "The Needle Knows"],
  sewing: ["Straight Seams", "Cutting Without Fear"],
  woodworking: ["Sawdust Everywhere", "The Grain Speaks"],
  "jewelry-making": ["Small and Precise", "Steady at the Bench"],
  "candle-making": ["The House Smells Good", "Perfect Pour"],
  "3d-printing": ["First Clean Layer", "The Printer Obeys"],
  electronics: ["It Lit Up", "Reading the Board"],
  robotics: ["It Moved", "It Listens Now"],
  coding: ["It Compiles", "Fluent in the Machine"],
  "game-development": ["Someone Played It", "Worlds on Demand"],
  running: ["Early Miles", "The Long Way Home"],
  "run-clubs": ["Early Miles", "The Long Way Home"],
  yoga: ["Breath and Balance", "Stillness Comes Easy"],
  climbing: ["New Height", "The Wall Reads Itself"],
  cycling: ["Wind in the Spokes", "Any Distance, Any Day"],
  dance: ["Found the Beat", "The Body Remembers"],
  pickleball: ["Dinks and Drives", "Owning the Kitchen"],
  swimming: ["Lengths and Lengths", "At Home in the Water"],
  hiking: ["Boots Broken In", "The Trail Is Home"],
  "strength-training": ["Something Got Heavier", "Strong on Purpose"],
  weightlifting: ["Something Got Heavier", "Strong on Purpose"],
  cooking: ["Cooking Without the Recipe", "The Kitchen Obeys"],
  baking: ["Warm From the Oven", "Baker's Hands"],
  sourdough: ["The Starter Lives", "Bread on Instinct"],
  espresso: ["The Shot Ran True", "Dialled In"],
  "home-coffee": ["The Pour Slowed Down", "Dialled In"],
  "cocktail-making": ["Balanced at Last", "Free Pour"],
  gardening: ["Dirt Under the Nails", "The Garden Keeps Itself"],
  houseplants: ["Nothing Died", "Everything Thriving"],
  foraging: ["A Full Basket", "The Woods Are Legible"],
  birdwatching: ["Learned Their Calls", "Knows Them by Wing"],
  camping: ["Slept Outside", "At Home Outdoors"],
  painting: ["Colour on My Hands", "The Brush Knows"],
  drawing: ["Filled a Sketchbook", "Drawing Without Looking"],
  watercolor: ["Let the Water Work", "Wet on Wet, on Purpose"],
  photography: ["Started Seeing Light", "Frames It Instantly"],
  filmmaking: ["Finished a Cut", "Tells It in Pictures"],
  "music-production": ["Finished a Track", "Hears It Before It Plays"],
  instrument: ["Played It Through", "Music Without Thinking"],
  singing: ["Found My Range", "The Voice Obeys"],
  writing: ["Filled the Page", "Words Come Easy"],
  poetry: ["Filled the Page", "Words Come Easy"],
  journaling: ["Kept at It", "The Page Waits Patiently"],
  calligraphy: ["Steady Line", "Ink Behaves"],
  chess: ["Saw It Coming", "Thinks in Positions"],
  "board-games": ["Learned the Table", "Knows Every Rule"],
  books: ["A Real Stack", "Read Everything Here"],
  puzzles: ["Edges First", "Sees the Whole Picture"],
  thrifting: ["A Good Find", "Knows a Treasure"],
  "language-learning": ["First Real Sentence", "Dreams in It"],
};

/**
 * The name to show for a milestone, given the hobby someone is deepest in.
 * `hobbySlug` is a sub-hobby slug (e.g. "pottery").
 */
export function badgeName(badge: Badge, hobbySlug?: string, _hobbyLabel?: string): string {
  if (!CRAFT_BADGE_IDS.has(badge.id) || !hobbySlug) return badge.name;
  const named = CRAFT_NAMES[hobbySlug];
  if (!named) return badge.name;
  return badge.id === "second-nature" ? named[1] : named[0];
}

