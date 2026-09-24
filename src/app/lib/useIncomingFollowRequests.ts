import { useEffect, useState } from "react";
import { fetchIncomingFollowRequests, IncomingFollowRequest } from "./profileFollows";

/** Pending follow requests waiting on you — the same shape ConnectionsContext
 * once kept live for incoming connection requests, now backed by
 * profile_follows. `refreshKey` lets a caller force a refetch right after
 * accepting or declining one, without this hook needing to know why. `null`
 * while loading. */
export function useIncomingFollowRequests(
  userId: string | undefined,
  refreshKey = 0,
): IncomingFollowRequest[] | null {
  const [requests, setRequests] = useState<IncomingFollowRequest[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    fetchIncomingFollowRequests(userId).then((rows) => {
      if (!cancelled) setRequests(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return requests;
}
