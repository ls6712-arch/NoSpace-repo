/**
 * Every count in the UI goes through here, so we never show "1 Moments" or
 * "1 people".
 *
 *   plural(1, "Moment")                 → "1 Moment"
 *   plural(3, "Moment")                 → "3 Moments"
 *   plural(1, "person", "people")       → "1 person"
 *   plural(1200, "Moment")              → "1,200 Moments"
 *   plural(1200, "Moment", { compact }) → "1.2k Moments"
 *
 * The word alone (for sentences that place the number themselves):
 *
 *   pluralWord(1, "person", "people")   → "person"
 *   pluralWord(2, "is", "are")          → "are"
 */
import { formatCount } from "./formatCount";

export function pluralWord(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

export interface PluralOptions {
  /** Shorten big numbers to fit tight spaces: 1.2k, 12k, 1.2M. */
  compact?: boolean;
}

export function plural(n: number, one: string, many?: string | PluralOptions, opts?: PluralOptions): string {
  const manyWord = typeof many === "string" ? many : undefined;
  const o = (typeof many === "object" ? many : opts) ?? {};
  const num = o.compact ? formatCount(n) : n.toLocaleString("en-US");
  return `${num} ${pluralWord(n, one, manyWord)}`;
}
