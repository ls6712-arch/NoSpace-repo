import { useEffect, useState } from "react";
import { fetchFollowerCount } from "./profileFollows";

/** Live-enough follower count for one profile — refetches whenever
 * `refreshKey` changes, so a follow/unfollow toggle can ask for a fresh
 * read without this hook needing to know how the count changed. `null`
 * while loading; the caller decides what to show meanwhile (usually
 * nothing, rather than a flash of "0"). */
export function useFollowerCount(profileId: string | undefined, refreshKey = 0): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profileId) {
      setCount(null);
      return;
    }
    let cancelled = false;
    fetchFollowerCount(profileId).then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [profileId, refreshKey]);

  return count;
}
