// Stubby plan §5: reading an ask in code, instantly, before any search. Pure: no network, no
// database, no Deno (tested in stubby-scout.test.ts).
//
// From the ask's own words, then the profile, then the person's answer to Stubby's one question:
//   when    a time window. "Tonight" is a hard filter (stubby-plan §6.3); no "when" means the
//           next 7 days, leaning on the person's free windows if they have any.
//   who     solo, partner, friends or family.
//   budget  a per-outing ceiling: "free", "under $20" or "cheap" in the ask, else about a
//           quarter of the monthly budget.
//   what    the kind of thing, when the ask names one.
// And whether one thing is still missing that's worth one question (who, then when, then what).

import { HOME_TZ } from "./picks.ts";

export type Who = "solo" | "partner" | "friends" | "family";
export type WhenLabel = "tonight" | "today" | "tomorrow" | "weekend" | "day" | "week";
export type Vibe = "active" | "make" | "food" | "chill" | "learn";
export type Missing = "who" | "when" | "what";

export interface Window {
  startMs: number;
  endMs: number;
  label: WhenLabel;
  /** Said in the ask (or answered): picks must start inside it. */
  hard: boolean;
}

export interface Budget {
  /** Most a pick may cost, in dollars. 0 means free only. */
  max: number;
  /** Free only. */
  free: boolean;
  from: "ask" | "profile";
}

export interface Intent {
  when: Window | null;
  who: Who | null;
  budget: Budget | null;
  vibes: Vibe[];
  /** The ask names a particular thing (pottery, a run, a museum), not just "something fun". */
  specific: boolean;
  /** The ask asks for bars, breweries, tastings or 21+: otherwise those are left out. */
  adults: boolean;
  /** The one question worth asking, or null. Never more than one per ask. */
  missing: Missing | null;
}

export interface Answers {
  who?: Who;
  when?: "tonight" | "tomorrow" | "weekend";
}

export interface IntentContext {
  now: number;
  /** The usual week: "sat-eve" and the like. */
  windows?: readonly string[];
  monthlyBudget?: number | null;
  /** Their picked Corners' names, so "pottery" counts as a particular thing. */
  cornerNames?: readonly string[];
  answers?: Answers | null;
}

const HOUR = 3_600_000;
/** With no "when", look this far ahead. */
export const DEFAULT_DAYS = 7;

// ── New York calendar ─────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat("en-US", { timeZone: HOME_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function nyParts(ms: number) {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), dow: DOW[p.weekday] ?? 0 };
}

/** A New York wall clock time to ms. Day overflow (d + 1) is fine. */
export function nyTime(y: number, m: number, d: number, hour: number, minute = 0): number {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let ms = guess;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(ms);
    ms += guess - Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute);
  }
  return ms;
}

/** Midnight at the start of the day `offset` days from now's day. */
const dayStart = (now: number, offset: number) => {
  const t = nyParts(now);
  return nyTime(t.y, t.m, t.d + offset, 0);
};

// ── the words ─────────────────────────────────────────────────────────────

const WHO: [Who, RegExp][] = [
  ["family", /\b(kids?|children|child|family|toddlers?|my (son|daughter|parents|mom|dad|nephew|niece)|all ages)\b/i],
  ["partner", /\b(girlfriend|boyfriend|partner|wife|husband|spouse|fianc[ée]e?|date night|on a date|my (gf|bf|date))\b/i],
  ["friends", /\b(friends|mates|buddies|my crew|a group|group of|with people|the gang)\b/i],
  ["solo", /\b(solo|alone|by myself|on my own|just me|for one|myself)\b/i],
];

const VIBES: [Vibe, RegExp][] = [
  ["active", /\b(run|running|runs|hike|hiking|climb|climbing|bouldering|yoga|pilates|bike|biking|cycling|ride|dance|dancing|swim|swimming|sports?|walk|walking|active|outdoors?|outside|park)\b/i],
  ["make", /\b(pottery|ceramics?|clay|wheel|craft|crafts|crafty|paint|painting|draw|drawing|sketch|knit|knitting|sew|sewing|woodwork(ing)?|make something|making|build|printmaking|workshop)\b/i],
  ["food", /\b(food|dinner|lunch|brunch|eat|eating|cook|cooking|bake|baking|coffee|tea|market|tasting|wine|beer)\b/i],
  ["chill", /\b(chill|relax|relaxing|quiet|calm|cozy|cosy|museum|gallery|read|reading|books?|film|movie|cinema)\b/i],
  ["learn", /\b(learn|learning|class|classes|lecture|talk|course|lesson|lessons|seminar|reading group)\b/i],
];

const ADULTS = /\b(brewery|breweries|bars?|pubs?|21\+|tasting|tastings|wine|beer|cocktails?|happy hour)\b/i;

/** Words that carry no "what": an ask made only of these and a time or a who needs one question. */
const EMPTY_WORDS = new Set(
  "a an and any anything are around can do doing for get go good i id i'd ideas idea im i'm in is it let's lets me my near need of on or out over please plans plan some something stuff that the things thing this to up want what with you".split(" "),
);

function readWhen(text: string, now: number): Window | null {
  const t = text.toLowerCase();
  const today = nyParts(now);
  const endOfDay = (offset: number) => dayStart(now, offset + 1);
  if (/\b(tonight|this evening|later today)\b/.test(t)) return { startMs: now, endMs: endOfDay(0), label: "tonight", hard: true };
  if (/\btoday\b/.test(t)) return { startMs: now, endMs: endOfDay(0), label: "today", hard: true };
  if (/\btomorrow\b/.test(t)) return { startMs: dayStart(now, 1), endMs: endOfDay(1), label: "tomorrow", hard: true };
  // This weekend's Friday, in days from today: already in the weekend, the Friday just gone.
  const toFri = today.dow === 6 ? -1 : today.dow === 0 ? -2 : 5 - today.dow;
  const weekend = (fromFri: number): Window => {
    const p = nyParts(dayStart(now, fromFri) + 12 * HOUR);
    const start = nyTime(p.y, p.m, p.d, 17);
    // Friday 5 pm to the end of Sunday; already in it, from now.
    return { startMs: Math.max(start, now), endMs: dayStart(now, fromFri + 3), label: "weekend", hard: true };
  };
  if (/\bnext weekend\b/.test(t)) return weekend(toFri + 7);
  if (/\b(this weekend|weekend|saturday and sunday)\b/.test(t)) return weekend(toFri);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (const [i, name] of days.entries()) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const offset = (i - today.dow + 7) % 7;
      return { startMs: offset === 0 ? now : dayStart(now, offset), endMs: endOfDay(offset), label: "day", hard: true };
    }
  }
  if (/\bthis week\b/.test(t)) return { startMs: now, endMs: dayStart(now, DEFAULT_DAYS), label: "week", hard: true };
  return null;
}

function readBudget(text: string, monthly: number | null | undefined): Budget | null {
  const t = text.toLowerCase();
  if (/\b(free|no cost|costs nothing|\$0)\b/.test(t)) return { max: 0, free: true, from: "ask" };
  const m = /\b(?:under|below|less than|up to|max|at most|no more than)\s*\$?\s*(\d{1,4})\b|\$\s*(\d{1,4})\s*(?:or less|or under|max)\b/.exec(t);
  if (m) return { max: Number(m[1] ?? m[2]), free: false, from: "ask" };
  if (/\b(cheap|budget|inexpensive|affordable)\b/.test(t)) return { max: 20, free: false, from: "ask" };
  if (typeof monthly === "number" && monthly >= 0) return { max: Math.floor(monthly / 4), free: monthly === 0, from: "profile" };
  return null;
}

/** Reads an ask. Never throws; anything it can't read is left null. */
export function readIntent(raw: string, ctx: IntentContext): Intent {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const answers = ctx.answers ?? null;

  let who: Who | null = null;
  for (const [w, re] of WHO) if (re.test(text)) { who = w; break; }
  if (answers?.who) who = answers.who;

  let when = readWhen(text, ctx.now);
  if (answers?.when) when = readWhen(answers.when === "weekend" ? "this weekend" : answers.when, ctx.now);

  const vibes = VIBES.filter(([, re]) => re.test(text)).map(([v]) => v);
  const corners = (ctx.cornerNames ?? []).map((c) => c.toLowerCase()).filter((c) => c.length > 2);
  const namesCorner = corners.some((c) => lower.includes(c));
  const specific = vibes.length > 0 || namesCorner;

  // What is left once the time, the who and the filler words are taken out.
  const content = lower
    .replace(/\b(tonight|this evening|later today|today|tomorrow|this weekend|next weekend|weekend|this week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, " ")
    .replace(/\b(girlfriend|boyfriend|partner|wife|husband|kids?|children|family|friends|solo|alone|by myself|on my own|just me)\b/g, " ")
    .split(/[^a-z'+$0-9]+/)
    .filter((w) => w && !EMPTY_WORDS.has(w));

  const hasWindows = (ctx.windows ?? []).length > 0;
  let missing: Missing | null = null;
  // One question per ask: once they have answered, he searches.
  if (!answers?.who && !answers?.when) {
    if (!specific && !who) missing = "who";
    else if (!specific && !when && !hasWindows) missing = "when";
    else if (!specific && content.length === 0 && who && when) missing = "what";
  }

  return {
    when,
    who,
    budget: readBudget(text, ctx.monthlyBudget),
    vibes,
    specific,
    adults: ADULTS.test(text),
    missing,
  };
}

/** The window the search looks in: the ask's own, else the next 7 days. */
export function searchWindow(intent: Intent, now: number): Window {
  return intent.when ?? { startMs: now, endMs: dayStart(now, DEFAULT_DAYS + 1), label: "week", hard: false };
}
