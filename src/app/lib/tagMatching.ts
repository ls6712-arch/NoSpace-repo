/**
 * Single source of truth for "does this tag already exist?"
 *
 * Used by every free-text entry point that can mint a new tag/Corner/
 * category: the composer's InterestField, the Explore modal's own-interest
 * field, and the Suggest-a-Space / Create-a-Corner flow. Before this,
 * each of those had its own (or no) duplicate check, so "espresso" typed
 * into three different boxes could produce three different outcomes.
 *
 * Deliberately conservative: this suggests, it never silently blocks or
 * silently redirects. The person can always confirm "no, I mean something
 * different" — see MatchResult.kind below.
 */

/** Case-fold, trim, collapse whitespace, strip accents and punctuation. */
export function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics: café -> cafe
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/** Classic edit distance, capped early once it exceeds `max` (cheap bail-out). */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      rowMin = Math.min(rowMin, dp[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return dp[b.length];
}

/** How tolerant to be, scaled by word length — "id" and "is" shouldn't collide. */
function distanceBudget(len: number): number {
  if (len <= 4) return 0; // "espn" vs "espy": stay exact at this length
  if (len <= 7) return 1; // espresso(8) not in this band, see below
  return 2;
}

export type MatchKind = "exact" | "fuzzy" | "prefix";

export interface MatchResult {
  label: string; // the existing tag's canonical display label
  kind: MatchKind;
}

/**
 * Find existing tags that `input` is plausibly a duplicate, typo, or
 * truncation of. `known` should be canonical display labels (e.g. the
 * first-ever casing someone used), already deduped by the caller.
 *
 * Returns best match first. Empty array means "looks genuinely new."
 */
export function findPossibleDuplicates(input: string, known: string[]): MatchResult[] {
  const q = normalize(input);
  if (!q || q.length < 2) return [];

  const results: MatchResult[] = [];

  for (const label of known) {
    const k = normalize(label);
    if (!k) continue;

    if (k === q) {
      results.push({ label, kind: "exact" });
      continue;
    }

    // Truncation / abbreviation: "esp" -> "espresso". Guard against noise by
    // requiring the typed text be a real prefix of some length, not just any
    // short string ("a" matching everything).
    if (q.length >= 3 && k.startsWith(q)) {
      results.push({ label, kind: "prefix" });
      continue;
    }

    // Typo: "expresso" -> "espresso", "esresso" -> "espresso".
    const budget = distanceBudget(Math.max(k.length, q.length));
    if (budget > 0 && levenshtein(k, q, budget) <= budget) {
      results.push({ label, kind: "fuzzy" });
    }
  }

  // Exact beats prefix beats fuzzy; within a tier, shorter labels (closer to
  // what was typed) sort first.
  const rank = { exact: 0, prefix: 1, fuzzy: 2 };
  return results
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.length - b.label.length)
    .slice(0, 3);
}

/** Convenience for the common "just tell me the single best match" case. */
export function bestMatch(input: string, known: string[]): MatchResult | null {
  return findPossibleDuplicates(input, known)[0] ?? null;
}
