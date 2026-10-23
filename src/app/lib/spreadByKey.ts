/**
 * Reorders a list so no two neighbours share a key (the category of a card), as
 * far as the list allows. Stable: it takes the earliest item whose key differs
 * from the previous one, so the original order is kept wherever it already
 * works. If only same-key items are left they go on the end.
 */
export function spreadByKey<T>(items: readonly T[], keyOf: (item: T) => string | undefined): T[] {
  const rest = [...items];
  const out: T[] = [];
  while (rest.length > 0) {
    const last = out.length ? keyOf(out[out.length - 1]) : undefined;
    let i = rest.findIndex((item) => last === undefined || keyOf(item) !== last);
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
