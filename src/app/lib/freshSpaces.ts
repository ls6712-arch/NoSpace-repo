import type { SpaceRow } from "./spaces";

const DAY = 86_400_000;

/** Spaces opened within the last 7 days, newest first. Home's "Freshly
 * opened this week" reads this so the window is defined in one place. */
export function freshSpaces<T extends Pick<SpaceRow, "created_at" | "status">>(
  rows: T[],
  now: number,
  limit: number,
): T[] {
  const cutoff = now - 7 * DAY;
  return rows
    .filter((s) => s.status === "active" && new Date(s.created_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
