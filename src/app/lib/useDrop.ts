import { useCallback, useEffect, useState } from "react";
import { fetchDrop, fetchMyDrop, fetchOpenDrop, joinDrop, type Drop, type MyDrop } from "./drops";

export interface DropState {
  status: "loading" | "ready";
  drop: Drop | null;
  /** Your own place in it. Null signed out, and until you join. */
  mine: MyDrop | null;
  joining: boolean;
  /** Joins and resolves to your Pursuit's id, or to an error message. */
  join: () => Promise<{ pursuitId: string | null; error: string | null }>;
  reload: () => void;
}

/**
 * One drop and where you stand in it: the drop at `slug`, or with no slug the
 * one that is open right now. `drop` is null when there is nothing to show.
 */
export function useDrop(slug: string | null, userId: string | undefined): DropState {
  const [state, setState] = useState<{ status: "loading" | "ready"; drop: Drop | null; mine: MyDrop | null }>({ status: "loading", drop: null, mine: null });
  const [joining, setJoining] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const drop = slug ? await fetchDrop(slug) : await fetchOpenDrop();
      const mine = drop && userId ? await fetchMyDrop(drop.id, userId) : null;
      if (live) setState({ status: "ready", drop, mine });
    })();
    return () => {
      live = false;
    };
  }, [slug, userId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const dropId = state.drop?.id;
  const join = useCallback(async () => {
    if (dropId == null) return { pursuitId: null, error: null };
    setJoining(true);
    const r = await joinDrop(dropId);
    setJoining(false);
    if (r.pursuitId) {
      const pursuitId = r.pursuitId;
      setState((s) => ({
        ...s,
        mine: s.mine ?? { pursuitId, edition: null, stubId: null },
        drop: s.drop && !s.mine && s.drop.peopleIn != null ? { ...s.drop, peopleIn: s.drop.peopleIn + 1 } : s.drop,
      }));
    }
    return r;
  }, [dropId]);

  return { ...state, joining, join, reload };
}
