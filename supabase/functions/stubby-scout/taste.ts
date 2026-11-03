// The taste profile (stubby_profiles) and recent feedback (stubby_feedback), turned into prompt
// lines. Everything here is data about the person, never instructions: interests are mapped from a
// fixed list of ids to fixed words (nothing typed reaches the prompt), the city is reduced to plain
// letters, and pick titles (which came from web pages) are flattened, cut short and dropped if they
// read like instructions. Pure (tested in taste.test.ts).

import { cleanText } from "./picks.ts";

/** The 8 mood ids (src/app/data/moods.ts) and what they mean, in the prompt's words. */
export const INTEREST_WORDS: Readonly<Record<string, string>> = {
  make: "making something with their hands",
  move: "moving: sport, dance, running",
  people: "being around people",
  alone: "time to themselves",
  outside: "getting outside",
  learn: "learning something",
  play: "playing a game",
  haveIt: "starting with what they already have",
};

export const TIMINGS = ["tonight", "weekend", "anytime"] as const;
export type Timing = (typeof TIMINGS)[number];
export const BUDGETS = ["free", "under_20", "under_50", "any"] as const;
export type BudgetChoice = (typeof BUDGETS)[number];

export interface Taste {
  city: string | null;
  interests: string[];
  timing: Timing | null;
  budget: BudgetChoice | null;
}

export interface Signal {
  signal: "up" | "down" | "save";
  title: string;
  kind: "event" | "idea" | null;
}

export const EMPTY_TASTE: Taste = { city: null, interests: [], timing: null, budget: null };

/** A city or neighborhood name: letters, spaces and a little punctuation, 80 characters at most. No coordinates. */
export function cleanCity(v: unknown): string | null {
  const s = cleanText(v).slice(0, 80);
  if (!s || /\d+[.,]\d+/.test(s)) return null;
  const kept = s.replace(/[^\p{L}\p{M} '.,-]/gu, "").replace(/\s+/g, " ").trim();
  return kept.length >= 2 ? kept.slice(0, 60) : null;
}

/** Reads a stubby_profiles row (or anything) into a Taste. Unknown values are dropped, never passed on. */
export function readTaste(row: unknown): Taste {
  if (!row || typeof row !== "object") return EMPTY_TASTE;
  const r = row as Record<string, unknown>;
  const interests = Array.isArray(r.interests)
    ? [...new Set(r.interests.filter((i): i is string => typeof i === "string" && Object.hasOwn(INTEREST_WORDS, i)))].slice(0, 10)
    : [];
  return {
    city: cleanCity(r.city),
    interests,
    timing: (TIMINGS as readonly unknown[]).includes(r.timing) ? (r.timing as Timing) : null,
    budget: (BUDGETS as readonly unknown[]).includes(r.budget) ? (r.budget as BudgetChoice) : null,
  };
}

export const tasteIsEmpty = (t: Taste) => !t.city && t.interests.length === 0 && !t.timing && !t.budget;

const INSTRUCTION_LIKE = /\b(ignore|disregard|forget)\b.{0,40}\b(instruction|prompt|rule|above|previous)|\bsystem prompt\b|\byou are (now )?\b|\bassistant\b|<\/?[a-z]/i;

/** A pick title as safe data: one line, no quotes or brackets, 60 characters, nothing that reads like an instruction. */
export function safeTitle(v: unknown): string | null {
  const s = cleanText(v).replace(/["“”<>{}[\]`]/g, "'").slice(0, 60).trim();
  if (s.length < 2 || INSTRUCTION_LIKE.test(s)) return null;
  return s;
}

/** Reads stubby_feedback rows, newest first, keeping at most 20 usable ones. */
export function readSignals(rows: unknown): Signal[] {
  if (!Array.isArray(rows)) return [];
  const out: Signal[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.signal !== "up" && o.signal !== "down" && o.signal !== "save") continue;
    const title = safeTitle(o.title);
    if (!title) continue;
    out.push({ signal: o.signal, title, kind: o.kind === "event" || o.kind === "idea" ? o.kind : null });
    if (out.length >= 20) break;
  }
  return out;
}

const BUDGET_WORDS: Record<BudgetChoice, string> = {
  free: "free things",
  under_20: "under $20",
  under_50: "under $50",
  any: "no set budget",
};
const TIMING_WORDS: Record<Timing, string> = { tonight: "tonight", weekend: "this weekend", anytime: "any time" };

/** Lines for the "About this person" block. Empty when there is nothing to say. */
export function tasteLines(t: Taste, signals: readonly Signal[]): string[] {
  const lines: string[] = [];
  if (t.city) lines.push(`- Area they gave: ${t.city}.`);
  if (t.interests.length) lines.push(`- Enjoys: ${t.interests.map((i) => INTEREST_WORDS[i]).join("; ")}.`);
  if (t.timing) lines.push(`- Usually looking for something ${TIMING_WORDS[t.timing]}.`);
  if (t.budget) lines.push(`- Budget they gave: ${BUDGET_WORDS[t.budget]}.`);
  const list = (s: Signal["signal"]) =>
    signals
      .filter((x) => x.signal === s)
      .slice(0, 8)
      .map((x) => `'${x.title}'`)
      .join(", ");
  const liked = list("up");
  const saved = list("save");
  const disliked = list("down");
  if (liked) lines.push(`- Earlier picks they liked: ${liked}.`);
  if (saved) lines.push(`- Earlier picks they kept: ${saved}.`);
  if (disliked) lines.push(`- Earlier picks that weren't for them: ${disliked}.`);
  return lines;
}
