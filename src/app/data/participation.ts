/**
 * The four ways to be part of something on NoSpace.
 *
 * None of these is a follower relationship. "Keep exploring" attaches you to a
 * hobby, not a person. "Join in" attaches you to a thing that is happening.
 * The two mutual ones are requests about doing something specific together,
 * and they are the only route to a private message — there are no cold DMs.
 */
export type ParticipationKind =
  | "keep_exploring"
  | "join_in"
  | "make_together"
  | "explore_together";

export interface ParticipationAction {
  kind: ParticipationKind;
  label: string;
  copy: string;
  /** Mutual actions need the other person to accept before anything happens. */
  mutual: boolean;
  /** Whether accepting opens a private thread. */
  unlocksMessaging: boolean;
}

export const ACTIONS: Record<ParticipationKind, ParticipationAction> = {
  keep_exploring: {
    kind: "keep_exploring",
    label: "Keep exploring",
    copy: "See more around this hobby.",
    mutual: false,
    unlocksMessaging: false,
  },
  join_in: {
    kind: "join_in",
    label: "Join in",
    copy: "Take part in something happening.",
    mutual: false,
    unlocksMessaging: false,
  },
  make_together: {
    kind: "make_together",
    label: "Make together",
    copy: "Create or do something together.",
    mutual: true,
    unlocksMessaging: true,
  },
  explore_together: {
    kind: "explore_together",
    label: "Explore together",
    copy: "Ask, compare, learn or share how you approach the hobby.",
    mutual: true,
    unlocksMessaging: true,
  },
};

export const ACTION_ORDER: ParticipationKind[] = [
  "keep_exploring",
  "join_in",
  "make_together",
  "explore_together",
];

/**
 * What "Explore together" and "Make together" actually mean in a given hobby.
 * Generic wording is a fallback, not the default — "ask about their setup"
 * is a real thing to say to a photographer; "connect" is not a thing to say
 * to anyone.
 */
interface HobbyIntents {
  exploreTogether: string[];
  makeTogether: string[];
}

const GENERIC: HobbyIntents = {
  exploreTogether: [
    "Ask about their process",
    "Compare approaches",
    "Learn how they got started",
    "Share how I do it",
  ],
  makeTogether: [
    "Work on something at the same time",
    "Set a shared goal",
    "Swap work in progress",
  ],
};

/** Keyed by sub-hobby slug first, then by Space slug. */
const BY_HOBBY: Record<string, HobbyIntents> = {
  photography: {
    exploreTogether: [
      "Ask about their setup",
      "Compare shooting approaches",
      "Learn their process",
      "Share my version",
    ],
    makeTogether: ["Shoot the same subject", "Go on a photo walk", "Swap edits of one frame"],
  },
  "outdoor-photography": {
    exploreTogether: [
      "Ask about their setup",
      "Compare shooting approaches",
      "Learn their process",
      "Share my version",
    ],
    makeTogether: ["Go on a photo walk", "Shoot the same location", "Swap edits"],
  },
  "food-photography": {
    exploreTogether: ["Ask about their lighting", "Compare styling", "Learn their process"],
    makeTogether: ["Shoot the same dish", "Swap edits of one frame"],
  },
  cooking: {
    exploreTogether: [
      "Ask about the technique",
      "Compare recipes",
      "Share my variation",
      "Learn their method",
    ],
    makeTogether: ["Cook the same dish", "Trade recipes for a week", "Plan a supper together"],
  },
  baking: {
    exploreTogether: ["Ask about the technique", "Compare recipes", "Share my variation"],
    makeTogether: ["Bake the same thing", "Trade formulas"],
  },
  sourdough: {
    exploreTogether: ["Ask about their starter", "Compare hydration", "Share my crumb"],
    makeTogether: ["Bake on the same day", "Trade starter notes"],
  },
  writing: {
    exploreTogether: [
      "Ask about their process",
      "Discuss the idea",
      "Share my interpretation",
      "Compare drafts",
    ],
    makeTogether: ["Write to the same prompt", "Swap drafts for notes", "Set a weekly deadline"],
  },
  poetry: {
    exploreTogether: ["Ask about the form", "Discuss the idea", "Share my interpretation"],
    makeTogether: ["Write to the same prompt", "Swap drafts for notes"],
  },
  pottery: {
    exploreTogether: [
      "Ask about their clay",
      "Compare throwing approaches",
      "Learn their glaze",
      "Share my version",
    ],
    makeTogether: ["Throw the same form", "Share a firing", "Set a shared series"],
  },
  ceramics: {
    exploreTogether: ["Ask about their glaze", "Compare approaches", "Learn their process"],
    makeTogether: ["Make a matching set", "Share a firing"],
  },
  running: {
    exploreTogether: ["Ask about their training", "Compare routes", "Learn their pacing"],
    makeTogether: ["Run the same route", "Train for the same race", "Set a weekly distance"],
  },
  climbing: {
    exploreTogether: ["Ask about the beta", "Compare approaches", "Learn their warm-up"],
    makeTogether: ["Project the same route", "Meet at the wall"],
  },
  knitting: {
    exploreTogether: ["Ask about the pattern", "Compare yarn choices", "Share my version"],
    makeTogether: ["Knit the same pattern", "Swap progress photos"],
  },
  woodworking: {
    exploreTogether: ["Ask about the joinery", "Compare finishes", "Learn their setup"],
    makeTogether: ["Build the same piece", "Share a shop day"],
  },
  coding: {
    exploreTogether: ["Ask about their stack", "Compare approaches", "Learn their workflow"],
    makeTogether: ["Build something together", "Pair on a problem", "Review each other's work"],
  },
};

const BY_SPACE: Record<string, HobbyIntents> = {
  thestudio: {
    exploreTogether: [
      "Ask about their process",
      "Discuss the work",
      "Share my interpretation",
      "Compare approaches",
    ],
    makeTogether: ["Work to the same prompt", "Swap works in progress"],
  },
  kitchentable: {
    exploreTogether: ["Ask about the technique", "Compare recipes", "Share my variation"],
    makeTogether: ["Cook the same thing", "Trade recipes"],
  },
  inmotion: {
    exploreTogether: ["Ask about their training", "Compare approaches", "Learn their routine"],
    makeTogether: ["Train together", "Meet for a session"],
  },
  workbench: {
    exploreTogether: ["Ask about their materials", "Compare techniques", "Learn their process"],
    makeTogether: ["Make the same thing", "Share a work session"],
  },
  rooted: {
    exploreTogether: ["Ask what they're growing", "Compare conditions", "Learn their method"],
    makeTogether: ["Grow the same thing", "Swap cuttings or seeds"],
  },
  buildstack: {
    exploreTogether: ["Ask about their stack", "Compare approaches", "Learn their workflow"],
    makeTogether: ["Build something together", "Pair on a problem"],
  },
  makerlab: {
    exploreTogether: ["Ask about their settings", "Compare approaches", "Learn their process"],
    makeTogether: ["Build the same thing", "Share a print run"],
  },
  rabbithole: {
    exploreTogether: ["Ask how they got into it", "Compare collections", "Learn what to look for"],
    makeTogether: ["Play together", "Trade or swap"],
  },
};

/**
 * The concrete things two people might do, for this hobby. Falls back to the
 * Space, then to generic wording — which is the only case where the app says
 * something as vague as "compare approaches".
 */
export function intentsFor(
  kind: "make_together" | "explore_together",
  subSlug: string | undefined,
  hobbySlug: string,
): string[] {
  const set =
    (subSlug ? BY_HOBBY[subSlug] : undefined) ?? BY_SPACE[hobbySlug] ?? GENERIC;
  return kind === "explore_together" ? set.exploreTogether : set.makeTogether;
}

/** Whether this hobby has real wording of its own, or is using the fallback. */
export function hasHobbyContext(subSlug: string | undefined, hobbySlug: string) {
  return !!(subSlug && BY_HOBBY[subSlug]) || !!BY_SPACE[hobbySlug];
}

/** How precisely a place is shown. Never exact unless the poster chose it. */
export type LocationPrivacy = "exact" | "neighborhood" | "city" | "approximate" | "hidden";

export const LOCATION_PRIVACY: { value: LocationPrivacy; label: string; copy: string }[] = [
  { value: "exact", label: "Exact", copy: "The precise address or spot" },
  { value: "neighborhood", label: "Neighborhood", copy: "The area, not the address" },
  { value: "city", label: "City", copy: "Just the city" },
  { value: "approximate", label: "Approximate", copy: "Roughly where, nothing more" },
  { value: "hidden", label: "Hidden", copy: "Not shown to anyone" },
];

/**
 * Renders a place at the precision its poster chose. Anything more precise
 * than they asked for never reaches the screen — the coarser forms are derived
 * here rather than trusting the display layer to remember.
 */
export function displayLocation(name: string | undefined, privacy: LocationPrivacy | undefined) {
  if (!name) return undefined;
  const level = privacy ?? "neighborhood";
  if (level === "hidden") return undefined;
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (level === "exact") return name;
  if (level === "city") return parts[parts.length - 1] ?? name;
  if (level === "approximate") return `Near ${parts[parts.length - 1] ?? name}`;
  // neighborhood: drop a street number or house name, keep the area
  return parts.length > 1 ? parts.slice(-2).join(", ") : name;
}
