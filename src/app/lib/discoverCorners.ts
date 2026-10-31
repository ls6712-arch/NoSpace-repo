import { CORNER_IDEAS } from "../data/cornerIdeas";
import { cornerGuide } from "../data/cornerGuides";
import { cornerIdea } from "../data/cornerIdeas";
import { isBrowsableCorner, subHobbyLabel, titleCaseSlug } from "../data/hobbies";
import { cornerPath } from "./cornerPath";
import type { DiscoverCorner } from "./discover";

/**
 * "Corners new to you": the Corners the app offers the server to pick from, and the
 * words and links on each tear-off card. The card's lines are PROPOSED copy (the
 * founder approves them; see docs/discover-v2-ui-copy.md): the hook is the guide's
 * own description, the At home line is the idea's title (a short thing to do), and the other
 * two tabs say what is there or "Be the first".
 */

/** Corners with an idea (so a guide), not hidden from browsing, not 21 and over. */
export function cornerCandidates(): string[] {
  return Object.entries(CORNER_IDEAS)
    .filter(([key, idea]) => {
      const [space, corner] = key.split("/");
      return !idea.adultsOnly && isBrowsableCorner(space, corner);
    })
    .map(([key]) => key);
}

/** For a visitor with no taste to rank by: the first Corner of each internal category, then the next of each, and so on. */
export function visitorCorners(count: number, keys: readonly string[] = cornerCandidates()): string[] {
  const byCategory = new Map<string, string[]>();
  for (const key of keys) {
    const category = key.split("/")[0];
    byCategory.set(category, [...(byCategory.get(category) ?? []), key]);
  }
  const out: string[] = [];
  for (let round = 0; out.length < count; round++) {
    const layer = [...byCategory.values()].flatMap((list) => (list[round] ? [list[round]] : []));
    if (layer.length === 0) break;
    out.push(...layer.slice(0, count - out.length));
  }
  return out;
}

export type CornerTabId = "home" | "people" | "place";

export interface CornerTab {
  id: CornerTabId;
  label: string;
  line: string;
  /** False when nothing is there yet: the tab says "Be the first" and starts something. */
  supplied: boolean;
  to: string;
}

export interface CornerCardModel {
  key: string;
  spaceSlug: string;
  slug: string;
  name: string;
  hook: string;
  tabs: CornerTab[];
}

export const TAB_LABELS: Record<CornerTabId, string> = { home: "At home", people: "With people", place: "At a place" };
/** Proposed, not approved. */
export const BE_THE_FIRST = "Be the first";
export const PEOPLE_LINE = "Open Pursuits with room";
export const PLACE_LINE = "Spaces and events near you";

export function cornerName(slug: string): string {
  return subHobbyLabel(slug) ?? titleCaseSlug(slug);
}

export function cornerCardModel(c: DiscoverCorner): CornerCardModel {
  const [spaceSlug, slug] = c.cornerKey.split("/");
  const guide = cornerGuide(spaceSlug, slug);
  const idea = cornerIdea(spaceSlug, slug);
  const page = cornerPath(spaceSlug, slug);
  const create = `hobby=${encodeURIComponent(spaceSlug)}&sub=${encodeURIComponent(slug)}`;
  return {
    key: c.cornerKey,
    spaceSlug,
    slug,
    name: cornerName(slug),
    hook: guide?.about ?? "",
    tabs: [
      { id: "home", label: TAB_LABELS.home, line: idea?.ideaTitle ?? guide?.step ?? BE_THE_FIRST, supplied: c.hasHome && !!guide, to: `${page}?section=home` },
      c.hasGroup
        ? { id: "people", label: TAB_LABELS.people, line: PEOPLE_LINE, supplied: true, to: `${page}?section=people` }
        : { id: "people", label: TAB_LABELS.people, line: BE_THE_FIRST, supplied: false, to: `/pursuits/new?${create}&together=1` },
      c.hasPlace
        ? { id: "place", label: TAB_LABELS.place, line: PLACE_LINE, supplied: true, to: `${page}?section=place` }
        : { id: "place", label: TAB_LABELS.place, line: BE_THE_FIRST, supplied: false, to: "/create-space" },
    ],
  };
}
