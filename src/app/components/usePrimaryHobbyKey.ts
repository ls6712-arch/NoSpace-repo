import { useRewards } from "../context/RewardsContext";
import { subHobbyLabel } from "../data/hobbies";

/**
 * The Corner you've logged the most sessions in, as a slug + label — used to
 * name the craft-specific badges ("Master Potter" rather than "Mastery").
 *
 * Reads from the rewards ledger rather than from posts, so it agrees exactly
 * with what the badge unlock tests count. Returns empty (generic badge
 * names) when there's nothing logged yet — or when everything logged is
 * untagged. Spec change ("Corners carry discovery"): a Category name never
 * appears here either, same as ProfileHeadline. Untagged sessions are
 * stored as `space:<slug>` (a whole Category, not a craft) and are
 * excluded from the tally entirely, not given a Category-named fallback.
 */
export function usePrimaryHobbyKey(): { slug?: string; label?: string } {
  const { stats } = useRewards();

  const counts = new Map<string, number>();
  for (const key of stats.hobbiesPosted) {
    if (key.startsWith("space:")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return {};

  const [topKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { slug: topKey, label: subHobbyLabel(topKey) ?? topKey };
}
