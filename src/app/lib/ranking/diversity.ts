/**
 * Greedy re-rank (brief §4.5): walk the list in score order; at each slot take
 * the first remaining item that fits, skipping a breaking item until a later
 * slot where it fits. If nothing left fits, the best remaining goes in (the
 * list is never shortened by a rule).
 */
export function greedyRerank<T>(items: readonly T[], fits: (placed: readonly T[], item: T) => boolean, cap = Infinity): T[] {
  const rest = [...items];
  const out: T[] = [];
  while (rest.length > 0 && out.length < cap) {
    let i = rest.findIndex((item) => fits(out, item));
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

/** Seen tonight and All Moments: at most 1 per author in the top 4, and never 2 in a row. */
export function momentFits<T>(authorOf: (item: T) => string | undefined) {
  return (placed: readonly T[], item: T): boolean => {
    const a = authorOf(item);
    if (a === undefined) return true;
    if (placed.length > 0 && authorOf(placed[placed.length - 1]) === a) return false;
    if (placed.length < 4 && placed.some((p) => authorOf(p) === a)) return false;
    return true;
  };
}
