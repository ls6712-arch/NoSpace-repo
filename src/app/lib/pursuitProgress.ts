import { Measure, MeasureKind, Project, ProgressEntry } from "./journal";

/** The five answers to "How should progress add up?", in the order shown. */
export const MEASURE_KINDS: { kind: MeasureKind; title: string; copy: string; unit: string; example: string }[] = [
  { kind: "count", title: "Count completed things", copy: "Paintings, pieces, books, runs", unit: "things", example: "Paint 10 paintings" },
  { kind: "quantity", title: "Add up quantities", copy: "Words, pages, miles, dollars", unit: "words", example: "Write 20,000 words" },
  { kind: "time", title: "Track time spent", copy: "Hours of practice", unit: "hours", example: "Practice 50 hours" },
  { kind: "milestones", title: "Track milestones", copy: "Named steps, in order", unit: "milestones", example: "Get to a first gig" },
  { kind: "custom", title: "Define your own measurement", copy: "Your unit, your rules", unit: "", example: "Anything else" },
];

export function defaultMeasure(kind: MeasureKind): Measure {
  const base = MEASURE_KINDS.find((m) => m.kind === kind)!;
  return {
    kind,
    target: kind === "quantity" ? 20000 : kind === "time" ? 50 : kind === "milestones" ? 3 : 10,
    unit: base.unit,
    allowPartial: kind === "quantity" || kind === "time",
    allowDecimals: kind === "time",
    defaultAmount: kind === "quantity" ? 500 : 1,
    startingAmount: 0,
    milestones: kind === "milestones" ? ["", "", ""] : undefined,
  };
}

export function formatAmount(n: number, allowDecimals = true): string {
  const v = allowDecimals ? Math.round(n * 100) / 100 : Math.round(n);
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "20,000 words" */
export function targetText(m: Measure): string {
  return `${formatAmount(m.target)} ${m.unit}`.trim();
}

/** Entries that count for one person (or for the whole group when userId is null). */
export function entriesFor(entries: ProgressEntry[], projectId: string, userId?: string | null) {
  return entries.filter(
    (e) => e.projectId === projectId && (userId === null || userId === undefined ? true : (e.userId ?? "") === userId),
  );
}

export interface ProgressSummary {
  current: number;
  target: number;
  remaining: number;
  /** 0–1, clamped. */
  fraction: number;
  percent: number;
  done: boolean;
}

export function summarize(measure: Measure, entries: ProgressEntry[], includeStart = true): ProgressSummary {
  const logged = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const current = (includeStart ? measure.startingAmount : 0) + logged;
  const target = Math.max(0, measure.target);
  const fraction = target > 0 ? Math.min(1, current / target) : 0;
  return {
    current,
    target,
    remaining: Math.max(0, target - current),
    fraction,
    percent: Math.round(fraction * 100),
    done: target > 0 && current >= target,
  };
}

/** Whole numbers unless the Pursuit allows decimals; never negative. */
export function normalizeAmount(measure: Measure, raw: number): number {
  let v = Number.isFinite(raw) ? raw : 0;
  if (!measure.allowDecimals) v = Math.round(v);
  if (!measure.allowPartial && measure.kind !== "quantity" && measure.kind !== "time") v = Math.round(v);
  return Math.max(0, v);
}

/** The step size for the − / + stepper. */
export function stepFor(measure: Measure): number {
  if (measure.kind === "quantity") return Math.max(1, Math.round(measure.defaultAmount / 5) || 100);
  if (measure.allowDecimals) return 0.5;
  return 1;
}

/** Singular unit for "1 painting". Good-enough English for common units. */
export function unitFor(measure: Measure, n: number): string {
  const u = measure.unit.trim();
  if (n !== 1 || !u.endsWith("s") || u.endsWith("ss")) return u;
  if (u.endsWith("ies")) return `${u.slice(0, -3)}y`;
  return u.slice(0, -1);
}

/**
 * A date input's "YYYY-MM-DD" as the END of that day in the viewer's own
 * time zone. `new Date("2026-12-31")` parses as UTC midnight, which is Dec
 * 30 anywhere west of London — the deadline showed a day early.
 */
export function localDateMs(value: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59).getTime();
}

/** A stored date back into a date input's "YYYY-MM-DD", in local time. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SPACE_KEYWORDS: [RegExp, string][] = [
  [/paint|draw|sketch|watercolou?r|illustrat|mural|art\b|calligraph/i, "art-creative"],
  [/knit|crochet|sew|pottery|ceramic|wood|craft|bookbind|embroider|quilt/i, "crafts-making"],
  [/writ|word|novel|book|read|poem|poetry|journal|blog/i, "books-writing"],
  [/guitar|piano|sing|song|music|drum|dj\b|violin|ukulele|band/i, "music"],
  [/run|mile|gym|lift|yoga|swim|cycl|climb|boulder|marathon|tennis|pickleball|fitness|workout/i, "sports-fitness"],
  [/cook|bake|recipe|bread|sourdough|meal/i, "food-cooking"],
  [/photo|film|video|camera/i, "photography-film"],
  [/garden|plant|grow/i, "home-garden"],
  [/hike|trail|camp|outdoor|bird/i, "nature-outdoors"],
  [/code|app|build|program|robot|electronic/i, "tech-building"],
  [/travel|trip|country|countries/i, "travel-adventure"],
  [/meditat|sleep|health|wellness/i, "health-wellness"],
];

/** Best-guess Space for a Pursuit that wasn't given one, from its goal text,
 * so its Moments aren't filed under whichever Space happens to be first in
 * the list (which is how a watercolor Moment got labelled "The Lego Makers"). */
export function guessSpace(title: string): string | undefined {
  return SPACE_KEYWORDS.find(([re]) => re.test(title))?.[1];
}

/** Projects with a measure read progress from entries; older ones from their goal. */
export function hasMeasure(p: Pick<Project, "measure">): p is { measure: Measure } {
  return !!p.measure && p.measure.target > 0;
}
