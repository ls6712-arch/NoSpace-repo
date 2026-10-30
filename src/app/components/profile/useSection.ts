import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileResult } from "../../lib/profileApi";

export type Section<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

/** Loads one block of the page on its own, so one failure never blanks the rest. */
export function useSection<T>(load: () => Promise<ProfileResult<T>>, key: string) {
  const [state, setState] = useState<Section<T>>({ status: "loading" });
  const run = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const mine = ++run.current;
    setState({ status: "loading" });
    const r = await loadRef.current();
    if (mine !== run.current) return;
    setState(r.ok ? { status: "ready", value: r.value } : { status: "error", message: r.message });
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      run.current++;
    };
  }, [reload, key]);

  const set = useCallback((value: T) => setState({ status: "ready", value }), []);
  return { state, reload, set };
}
