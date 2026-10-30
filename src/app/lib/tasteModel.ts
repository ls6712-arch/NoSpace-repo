import { plural } from "./plural";

/**
 * What the three taste screens (7 to 9) are made of: the Corners offered, the
 * 14 free windows, the four budgets and the kinds of pass. Pure, so the order
 * and the wording are testable. What is saved is in tasteRemote.ts.
 */

// ---------- picks ----------

export interface PickOption {
  /** "space-slug/corner-slug", canonical. */
  key: string;
  name: string;
  /** A friend who is already in this Corner: shown as "{FirstName}’s going" under it. */
  going?: string;
}

export interface PickInput {
  /** The curated list, in its own order. */
  curated: { key: string; name: string }[];
  /** Corners with something real near the person in the next 14 days, with how many things (events and open Pursuits). */
  activity: ReadonlyMap<string, number>;
  /** Every Corner's name by key (curated and others), to name an activity Corner or a saved pick that is not curated. */
  names: ReadonlyMap<string, string>;
  /** The friend's Pursuit's Corner, when the person came from an invite link. */
  arrival?: { key: string; going: string } | null;
  /** What is picked now, in the order it was picked. Always shown, even past the first 12. */
  selected: readonly string[];
  /** How many to offer before "+ Something else". */
  limit?: number;
}

export const PICK_LIMIT = 12;

/**
 * Corners that are the same activity under two names. Only one of a group is
 * ever offered (the first in line: the friend's, then the busiest, then the
 * curated order), so there is one chip per activity. Slugs, not keys, so a
 * Corner moved between Spaces still matches.
 */
const SAME_ACTIVITY: readonly (readonly string[])[] = [
  ["running", "run-clubs"],
  ["drawing", "life-drawing"],
  ["dance", "indian-classical-dance"],
  ["filmmaking", "film-clubs"],
  ["walking-clubs", "city-walks"],
];
const activityOf = (key: string) => {
  const slug = key.split("/")[1] ?? key;
  return SAME_ACTIVITY.find((g) => g.includes(slug))?.[0] ?? slug;
};

/** The first word of a name: "{FirstName}’s going". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 60) ?? "";
export const MIN_PICKS = 3;

/**
 * The Corners to offer, in this order: the friend's Corner (if they came from
 * an invite), then Corners with something real near them in the next 14 days
 * (most things first), then the rest of the curated list. 12 of them. Anything
 * already picked that is not in those 12 (a Corner found with "Something else",
 * or saved earlier) follows, so a pick is never hidden. A Corner with no name
 * we can show is left out. Nothing here can create a Corner.
 */
export function buildPickOptions(input: PickInput): PickOption[] {
  const limit = input.limit ?? PICK_LIMIT;
  const curatedByKey = new Map(input.curated.map((c) => [c.key, c]));
  const nameOf = (key: string) => curatedByKey.get(key)?.name ?? input.names.get(key);
  const out: PickOption[] = [];
  const seen = new Set<string>();
  const activities = new Set<string>();
  const add = (key: string, going?: string, force = false) => {
    if (seen.has(key)) return;
    const name = nameOf(key);
    if (!name) return;
    const activity = activityOf(key);
    if (!force && activities.has(activity)) return;
    seen.add(key);
    activities.add(activity);
    out.push({ key, name, going });
  };

  if (input.arrival) add(input.arrival.key, input.arrival.going);
  const byActivity = [...input.activity.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [key] of byActivity) {
    if (out.length >= limit) break;
    add(key);
  }
  for (const c of input.curated) {
    if (out.length >= limit) break;
    add(c.key);
  }
  for (const key of input.selected) add(key, undefined, true);
  return out;
}

/** True once there are enough picks to go on. No maximum. */
export const hasEnoughPicks = (n: number) => n >= MIN_PICKS;
/** "Pick 2 more" while short, so the disabled button says what is missing. */
export const picksMissingLine = (n: number) => `Pick ${Math.max(0, MIN_PICKS - n)} more`;

// ---------- free windows ----------

export const DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
] as const;

export const SLOTS = [
  { key: "day", label: "daytime", heading: "Daytime" },
  { key: "eve", label: "evening", heading: "Evening" },
] as const;

export type DayKey = (typeof DAYS)[number]["key"];
export type SlotKey = (typeof SLOTS)[number]["key"];

export const windowKey = (day: DayKey, slot: SlotKey) => `${day}-${slot}`;
export const ALL_WINDOWS: readonly string[] = DAYS.flatMap((d) => SLOTS.map((s) => windowKey(d.key, s.key)));

/** "Saturday daytime", the text a screen reader gets for a cell. */
export function windowLabel(day: DayKey, slot: SlotKey): string {
  const d = DAYS.find((x) => x.key === day);
  const s = SLOTS.find((x) => x.key === slot);
  return `${d?.label ?? day} ${s?.label ?? slot}`;
}

/** "5 windows a week", under the grid. */
export const windowCountLine = (n: number) => `${plural(n, "window")} a week`;

/** Only known windows, each once, in week order. */
export function cleanWindows(raw: unknown): string[] {
  const picked = new Set(Array.isArray(raw) ? raw.filter((w): w is string => typeof w === "string") : []);
  return ALL_WINDOWS.filter((w) => picked.has(w));
}

// ---------- budget ----------

/** "A month for doing things": the four amounts, in dollars. 0 is free only. */
export const BUDGETS = [0, 50, 100, 200] as const;
export type Budget = (typeof BUDGETS)[number];

export const budgetLabel = (n: Budget) => (n === 0 ? "Free only" : `$${n}`);
export const isBudget = (n: unknown): n is Budget => typeof n === "number" && (BUDGETS as readonly number[]).includes(n);

// ---------- passes ----------

export const PASS_KINDS = [
  { kind: "climbing", label: "Climbing" },
  { kind: "museum", label: "Museum" },
  { kind: "library", label: "Library" },
  { kind: "bike", label: "Bike" },
  { kind: "fitness", label: "Fitness" },
  { kind: "gear", label: "Gear" },
  { kind: "other", label: "Other" },
] as const;

export type PassKind = (typeof PASS_KINDS)[number]["kind"];

export interface Pass {
  id: string;
  kind: PassKind;
  /** What it is called: the kind's own name. */
  label: string;
  /** Where, if they want to say. */
  place: string;
}

export const PLACE_MAX = 80;
export const isPassKind = (k: unknown): k is PassKind => PASS_KINDS.some((p) => p.kind === k);
export const passLabel = (kind: PassKind) => PASS_KINDS.find((p) => p.kind === kind)?.label ?? "Other";

export function newPass(kind: PassKind, id: string): Pass {
  return { id, kind, label: passLabel(kind), place: "" };
}
