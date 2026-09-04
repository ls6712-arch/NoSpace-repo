import { useRewards } from "../context/RewardsContext";
import { subHobbyLabel, getHobby } from "../data/hobbies";

/**
 * The hobby you've logged the most sessions in, as a slug + label — used to
 * name the craft-specific badges ("Master Potter" rather than "Mastery").
 *
 * Reads from the rewards ledger rather than from posts, so it agrees exactly
 * with what the badge unlock tests count. Returns empty strings when there's
 * nothing logged yet, which leaves badges on their generic names.
 */
export function usePrimaryHobbyKey(): { slug?: string; label?: string } {
  const { stats } = useRewards();
  if (stats.hobbiesPosted.length === 0) return {};

  const counts = new Map<string, number>();
  for (const key of stats.hobbiesPosted) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [topKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Untagged sessions are stored as `space:<slug>` — a whole space isn't a
  // craft, so those keep the generic badge names.
  if (topKey.startsWith("space:")) {
    const hobby = getHobby(topKey.slice("space:".length));
    return { label: hobby?.shortName };
  }

  return { slug: topKey, label: subHobbyLabel(topKey) ?? topKey };
}
