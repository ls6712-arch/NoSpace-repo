import { CORNER_IDEAS } from "../data/cornerIdeas";
import { cornerGuide } from "../data/cornerGuides";
import { cornerIdea } from "../data/cornerIdeas";
import { isBrowsableCorner, subHobbyLabel, titleCaseSlug } from "../data/hobbies";
import { cornerPath } from "./cornerPath";
import type { DiscoverCorner } from "./discover";
import type { CornerNames } from "./discoverCornerNames";

/**
 * "Corners new to you": the Corners the app offers the server to pick from, and the
 * words and links on each tear-off card (copy approved Oct 31, 2026): the hook is the
 * guide's own description, the At home line is the idea's title (a short thing to do),
 * With people names the soonest open Pursuit and At a place the nearest Space (or says
 * "Find people to go with" / "Find a place near you" when there is no name), and a tab
 * with nothing there is left out.
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
/** What a tab says when there is something there but no name to show for it. */
export const PEOPLE_FALLBACK = "Find people to go with";
export const PLACE_FALLBACK = "Find a place near you";

export function cornerName(slug: string): string {
  return subHobbyLabel(slug) ?? titleCaseSlug(slug);
}

export function cornerCardModel(c: DiscoverCorner, names?: CornerNames): CornerCardModel {
  const [spaceSlug, slug] = c.cornerKey.split("/");
  const guide = cornerGuide(spaceSlug, slug);
  const idea = cornerIdea(spaceSlug, slug);
  const page = cornerPath(spaceSlug, slug);
  return {
    key: c.cornerKey,
    spaceSlug,
    slug,
    name: cornerName(slug),
    hook: guide?.about ?? "",
    // A tab with nothing behind it is left out, not filled with an invitation.
    tabs: [
      c.hasHome && guide ? { id: "home", label: TAB_LABELS.home, line: idea?.ideaTitle ?? guide.step ?? "", to: `${page}?section=home` } : null,
      c.hasGroup ? { id: "people", label: TAB_LABELS.people, line: names?.people ?? PEOPLE_FALLBACK, to: `${page}?section=people` } : null,
      c.hasPlace ? { id: "place", label: TAB_LABELS.place, line: names?.place ?? PLACE_FALLBACK, to: `${page}?section=place` } : null,
    ].filter((t): t is CornerTab => t !== null && t.line !== ""),
  };
}
