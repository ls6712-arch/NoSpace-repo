/** Never more than 4 characters (999, 1.2k, 12k, 999k, 1.2M, 12M), so a
 * count can't widen the row and push it out of the card. */
export function formatCount(n: number) {
  const short = (v: number, unit: string) =>
    v < 10 ? `${(Math.floor(v * 10) / 10).toString()}${unit}` : `${Math.floor(v)}${unit}`;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return short(n / 1000, "k");
  return short(Math.min(n / 1_000_000, 999), "M");
}
