import { CORNER_GUIDES, type CornerGuide } from "./cornerGuides";
import { categoryOfCorner } from "./cornerCategories";

/**
 * "What are you in the mood for?" on Discover. Each mood is a filter over
 * facts the activity library records about an activity (what kind of thing
 * it is, whether it needs other people, indoors or out, whether you can start
 * with what you have). None of them claims an outcome ("feel calmer", "get
 * fit"), per the trust rules: a mood names what you'd be doing, never what
 * it will do for you.
 *
 * Labels are proposals until the founder approves them for docs/glossary.md.
 */
export type MoodId = "make" | "move" | "people" | "alone" | "outside" | "learn" | "play" | "haveIt";

export interface Mood {
  id: MoodId;
  label: string;
  matches: (guide: CornerGuide, spaceSlug: string, cornerSlug: string) => boolean;
}

const MOVING = new Set(["running-fitness", "sports-martial-arts", "dance-stage"]);

export const MOODS: readonly Mood[] = [
  { id: "make", label: "Make something", matches: (g) => g.kind === "making" || g.kind === "project" },
  {
    id: "move",
    label: "Move",
    matches: (_g, space, corner) => MOVING.has(categoryOfCorner(space, corner)?.slug ?? ""),
  },
  { id: "people", label: "Be around people", matches: (g) => g.together === "together" },
  { id: "alone", label: "Some time to yourself", matches: (g) => g.together === "solo" },
  { id: "outside", label: "Get outside", matches: (g) => g.where === "outdoors" },
  { id: "learn", label: "Learn something", matches: (g) => g.kind === "skill" || g.kind === "exploring" },
  { id: "play", label: "Play a game", matches: (g) => g.kind === "games" },
  { id: "haveIt", label: "Start with what you have", matches: (g) => g.haveIt },
];

/** Corners for a mood, in library order. Adults-only activities never appear. */
export function cornersForMood(id: MoodId): { spaceSlug: string; cornerSlug: string; guide: CornerGuide }[] {
  const mood = MOODS.find((m) => m.id === id);
  if (!mood) return [];
  return Object.entries(CORNER_GUIDES)
    .map(([key, guide]) => {
      const [spaceSlug, cornerSlug] = key.split("/");
      return { spaceSlug, cornerSlug, guide };
    })
    .filter((c) => !c.guide.adultsOnly && mood.matches(c.guide, c.spaceSlug, c.cornerSlug));
}
