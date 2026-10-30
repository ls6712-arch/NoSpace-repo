import { allSubHobbies, titleCaseSlug } from "../data/hobbies";
import { cornerGuide } from "../data/cornerGuides";
import { CURATED_CORNERS } from "../data/curatedCorners";
import { pickKey } from "./tasteRemote";
import { formatDuration, formatTime, formatWeekday } from "./dates";
import { HOME_TZ, type WeekWindow } from "./homeWeek";
import { reasonLine } from "./homeReasons";
import type { Affinity } from "./recommend";
import type { HomeSuggestion, ReasonCode } from "./homeSuggestions";

/**
 * What Home lists: the ranked suggestions from the database, filled up with the
 * first step of a Corner the person picked when there are fewer than 4. One
 * shape for both so the cards do not care where a row came from.
 */

export type HomeItemKind = "event" | "open_pursuit" | "at_home";

export interface HomeItem {
  /** Stable for one visit: kind and the thing's id. */
  id: string;
  kind: HomeItemKind;
  /** The event id, the Pursuit id, or the Corner key for an at-home row. */
  refId: string;
  title: string;
  corner: { key: string; name: string; spaceSlug: string; slug: string };
  /** Space slug for a listing, to open it. */
  spaceSlug: string | null;
  /** "Thu, 7:00 PM · Gowanus", or "At home · 30 min". */
  detail: string;
  reasons: ReasonCode[];
  /** Null when no reason has approved wording. */
  why: string | null;
  /** Milliseconds; null for an at-home row with no free window. */
  startsAt: number | null;
  /** At-home: the guide's first step. */
  step?: string;
  score: number | null;
}

/** A Corner's name from its key, for any Corner the app knows, else its slug made readable. */
export function cornerName(key: string): string {
  const [spaceSlug, slug] = key.split("/");
  const found = allSubHobbies.find((s) => s.hobbySlug === spaceSlug && s.slug === slug) ?? allSubHobbies.find((s) => s.slug === slug);
  return found?.label ?? titleCaseSlug(slug ?? key);
}

function cornerParts(key: string) {
  const [spaceSlug = "", slug = ""] = key.split("/");
  return { key, name: cornerName(key), spaceSlug, slug };
}

/** "Thu, 7:00 PM" in New York time, then the place when there is one. */
function listingDetail(startsAt: number, place: string | null): string {
  const when = `${formatWeekday(startsAt, "short", HOME_TZ)}, ${formatTime(startsAt, HOME_TZ)}`;
  return place ? `${when} · ${place}` : when;
}

export function itemFromSuggestion(s: HomeSuggestion): HomeItem {
  return {
    id: `${s.kind}:${s.refId}`,
    kind: s.kind,
    refId: s.refId,
    title: s.title,
    corner: cornerParts(s.cornerKey),
    spaceSlug: s.spaceSlug || null,
    detail: listingDetail(s.startsAt, s.placeLabel),
    reasons: s.reasons,
    why: reasonLine({ reasons: s.reasons, startsAt: s.startsAt, friendName: s.friendName, passKind: s.passKind }),
    startsAt: s.startsAt,
    score: s.score,
  };
}

export interface AtHomeInput {
  /** How many rows are still needed. */
  need: number;
  /** Corner keys already on the list (a listing in the same Corner). */
  exclude: ReadonlySet<string>;
  picks: readonly string[];
  affinity: Affinity | null;
  /** The person's upcoming free windows, to say when a pick fits. */
  windows: readonly WeekWindow[];
}

const doableAtHome = (key: string) => {
  const [spaceSlug = "", slug = ""] = key.split("/");
  const g = cornerGuide(spaceSlug, slug);
  return !!g && !g.adultsOnly && g.where !== "outdoors" && g.together !== "together" && g.step.trim().length > 0;
};

/**
 * Rows to do at home, from the first step in the Corner guides: the person's
 * picks in the order they picked, then their strongest Corners by activity, then
 * the curated Corners. Never a Corner already listed, never one that needs to be
 * outdoors or with other people, never adults only.
 */
export function atHomeItems(input: AtHomeInput): HomeItem[] {
  if (input.need <= 0) return [];
  const picked = input.picks.map((k) => pickKey(...(k.split("/") as [string, string])));
  const byActivity = input.affinity
    ? [...input.affinity.corners.entries()].sort((a, b) => b[1].mine - a[1].mine).map(([k]) => pickKey(...(k.split("/") as [string, string])))
    : [];
  const curated = CURATED_CORNERS.map((c) => `${c.spaceSlug}/${c.slug}`);

  const order: { key: string; picked: boolean }[] = [];
  const seen = new Set<string>(input.exclude);
  for (const [list, isPick] of [[picked, true], [byActivity, false], [curated, false]] as const) {
    for (const key of list) {
      if (seen.has(key) || !doableAtHome(key)) continue;
      seen.add(key);
      order.push({ key, picked: isPick });
    }
  }

  const out: HomeItem[] = [];
  let windowIndex = 0;
  for (const { key, picked: isPick } of order.slice(0, input.need)) {
    const corner = cornerParts(key);
    const guide = cornerGuide(corner.spaceSlug, corner.slug)!;
    const curatedEntry = CURATED_CORNERS.find((c) => c.slug === corner.slug && c.spaceSlug === corner.spaceSlug);
    const window = isPick && input.windows.length > 0 ? input.windows[windowIndex++ % input.windows.length] : null;
    const reasons: ReasonCode[] = isPick ? (window ? ["picked", "fits_window"] : ["picked"]) : ["affinity"];
    const minutes = curatedEntry ? formatDuration(curatedEntry.durationMinutes) : "";
    out.push({
      id: `at_home:${key}`,
      kind: "at_home",
      refId: key,
      title: corner.name,
      corner,
      spaceSlug: null,
      detail: minutes ? `At home · ${minutes}` : "At home",
      reasons,
      why: reasonLine({ reasons, startsAt: window ? window.startMs : null, friendName: null, passKind: null }),
      startsAt: window ? window.startMs : null,
      step: guide.step,
      score: null,
    });
  }
  return out;
}

/** Ranked suggestions first, then at-home rows to make at least `minimum`. */
export function buildHomeItems(
  suggestions: readonly HomeSuggestion[],
  fill: Omit<AtHomeInput, "need" | "exclude">,
  minimum = 4,
): HomeItem[] {
  const listed = suggestions.map(itemFromSuggestion);
  const exclude = new Set(listed.map((i) => i.corner.key));
  return [...listed, ...atHomeItems({ ...fill, need: minimum - listed.length, exclude })];
}
