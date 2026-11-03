import { formatClock } from "./dates";
import { HOME_TZ, nyParts, nyTimeToMs, windowsLeft } from "./homeWeek";

/**
 * Everything Stubby says, from one fixed list (glossary: "Ask Stubby: the Stubby plan",
 * approved Nov 2, 2026). He talks only in Ask Stubby, on the Calendar stage: one short,
 * warm line at a time, 12 words at most, never a guilt trip, and never a promise he
 * hasn't read. Nothing here is written by a model.
 */
export const STUBBY_LINES = {
  /** Greeting lines (claude-code-brief-stubby-calendar-hero.md §2). */
  freeTonight: (from: string) => `You’re free tonight from ${from}. Want ideas?`,
  planToday: (title: string, at: string) => `${title} at ${at} tonight. Want something after?`,
  weekendOpen: "Your weekend’s open. Want ideas?",
  busyWeek: "Busy week! Want something for next week?",
  fallback: "What are you in the mood for?",
  outOfAsks: "That’s 3 for today. I’ll look again tomorrow.",
  /** While and after he looks (stubby-plan.md §3). */
  looking: "On it. Checking a few places.",
  /** After 12 seconds with no new step (stubby-plan §7, approved Nov 2, 2026). */
  stillLooking: "Still looking. Good finds take a moment.",
  found: "Here’s what I’d pick for you.",
  error: "Something went wrong on my end. Try again?",
  /** For the later plan PRs (the one question, the honest "nothing fits", the nudge). */
  /** The first question for a vague ask (stubby-agent C4, approved Nov 3, 2026). */
  missingSetting: "Stay in or head out?",
  /** Asked only when company changes the options: heading out, no one named. */
  missingWho: "Going solo or with someone?",
  missingWhen: "When are you free?",
  missingVibe: "What kind of fun?",
  nothingFits: "Nothing tonight that fits. Here’s the soonest after.",
  /** The same, for any time other than tonight (approved Nov 2, 2026). */
  nothingThen: "Nothing then that fits. Here’s the soonest after.",
  bringAFriend: "This one’s better with a friend. Bring someone?",
  /** When the deck runs out (stubby-plan §6.5, approved Nov 2, 2026). */
  deckRunOut: "That’s all I found. Want more?",
} as const;

/** Most words Stubby says in one line. */
export const MAX_LINE_WORDS = 12;
/** "Tonight" starts here, in New York, for the greeting. */
const EVENING_HOUR = 17;
/** Longest plan title in the greeting, so the line stays short. */
const TITLE_CHARS = 28;
const TITLE_WORDS = 5;

/** A plan's title cut to fit the greeting: whole words, then "…". */
export function cutTitle(title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  const words = clean.split(" ");
  if (clean.length <= TITLE_CHARS && words.length <= TITLE_WORDS) return clean;
  let out = "";
  for (const w of words.slice(0, TITLE_WORDS)) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > TITLE_CHARS - 1) break;
    out = next;
  }
  return `${(out || clean.slice(0, TITLE_CHARS - 1)).replace(/[\s,.;:]+$/, "")}…`;
}

const sameNyDay = (a: number, b: number) => {
  const x = nyParts(a);
  const y = nyParts(b);
  return x.y === y.y && x.m === y.m && x.d === y.d;
};

export interface GreetingInput {
  now: number;
  /** The usual week ("sat-eve", ...). */
  windows: readonly string[];
  /** The person's plans, any order. */
  plans: readonly { title: string; startsAt: number; endsAt?: number | null }[];
  /** Asks left today, once known. */
  asksLeft: number | null;
}

/**
 * Stubby's greeting on the Calendar stage, from what the calendar already shows. The
 * first that fits, in this order:
 *
 * 1. Out of asks.
 * 2. A plan later today, from 5 pm: "Pottery at 7 tonight. Want something after?"
 * 3. A free evening later today with nothing in it: "You're free tonight from 7."
 * 4. A free stretch this weekend (up to Sunday) with no plan on those days.
 * 5. Free time set, but every free window left this week has a plan in it.
 * 6. "What are you in the mood for?"
 */
export function greetingLine({ now, windows, plans, asksLeft }: GreetingInput): string {
  if (asksLeft === 0) return STUBBY_LINES.outOfAsks;

  const upcoming = [...plans].filter((p) => p.startsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  const tonight = upcoming.find((p) => sameNyDay(p.startsAt, now) && nyParts(p.startsAt).hour >= EVENING_HOUR);
  if (tonight) return STUBBY_LINES.planToday(cutTitle(tonight.title), formatClock(tonight.startsAt, HOME_TZ));

  const left = windowsLeft(windows, now);
  const busy = (startMs: number, endMs: number) =>
    plans.some((p) => p.startsAt < endMs && (p.endsAt ?? p.startsAt + 3_600_000) > startMs);

  const evening = left.find((w) => w.offset === 0 && w.slot === "eve");
  if (evening) {
    // Already in the evening: from the next half hour.
    const from = evening.startMs > now ? evening.startMs : Math.ceil(now / 1_800_000) * 1_800_000;
    if (from < evening.endMs && !busy(from, evening.endMs)) return STUBBY_LINES.freeTonight(formatClock(from, HOME_TZ));
  }

  // This weekend: the Saturday and Sunday before the next Monday (today included).
  // Days are stepped from today's noon, so a daylight saving change never skips one.
  const today = nyParts(now);
  const noon = (offset: number) => nyTimeToMs(today.y, today.m, today.d + offset, 12);
  const weekendOffsets = new Set<number>();
  for (let offset = 0; offset < 7; offset++) {
    const dow = nyParts(noon(offset)).dow;
    if (offset > 0 && dow === 1) break;
    if (dow === 6 || dow === 0) weekendOffsets.add(offset);
  }
  const weekend = left.filter((w) => weekendOffsets.has(w.offset));
  if (weekend.length > 0) {
    const days = [...weekendOffsets].map(noon);
    const planned = plans.some((p) => p.startsAt >= now && days.some((d) => sameNyDay(p.startsAt, d)));
    if (!planned) return STUBBY_LINES.weekendOpen;
  }

  if (windows.length > 0 && left.every((w) => busy(Math.max(w.startMs, now), w.endMs))) return STUBBY_LINES.busyWeek;

  return STUBBY_LINES.fallback;
}
