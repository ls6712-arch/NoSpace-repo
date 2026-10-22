import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigationType } from "react-router";

/**
 * View state that survives going back. `useScrollMemory` puts the window
 * back where it was, but a page that rebuilds itself from defaults (a
 * filter reset, "Show more" collapsed to its first page) is too short to
 * scroll that far. These hooks keep the parts of a view that decide its
 * height, and a horizontal row's position, so Back lands in the same place.
 *
 * Saved values are only read when arriving by Back/Forward (or a reload).
 * Opening the page fresh always starts from the defaults. They live in
 * sessionStorage, so they never outlast the tab.
 */
const PREFIX = "soosh-view:";

function read<T>(name: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + name);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function write(name: string, value: unknown) {
  try {
    sessionStorage.setItem(PREFIX + name, JSON.stringify(value));
  } catch {
    /* private mode or full: this page just starts fresh next time */
  }
}

/** `useState`, except the value comes back after Back/Forward. `name` must be
 * unique per piece of state and stable ("discover.shown"). */
export function useHistoryState<T>(name: string, initial: T) {
  const navType = useNavigationType();
  const [value, setValue] = useState<T>(() => (navType === "POP" ? (read<T>(name) ?? initial) : initial));
  useEffect(() => write(name, value), [name, value]);
  return [value, setValue] as const;
}

/**
 * Keeps a horizontally scrolling row where it was. Spread the result on the
 * scroller: `<div {...useRowScrollMemory("discover.spotlight")}>`. The row's
 * contents can arrive after it mounts, so restoring retries for a moment
 * until the row is wide enough.
 */
export function useRowScrollMemory(name: string) {
  const navType = useNavigationType();
  const el = useRef<HTMLElement | null>(null);
  const frame = useRef(0);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      el.current = node;
      if (!node || navType !== "POP") return;
      const target = read<number>("row:" + name);
      if (!target) return;
      const started = performance.now();
      const tryRestore = () => {
        node.scrollLeft = target;
        if (node.scrollLeft < target - 1 && performance.now() - started < 1500) {
          frame.current = requestAnimationFrame(tryRestore);
        }
      };
      tryRestore();
    },
    [name, navType],
  );

  const onScroll = useCallback(() => {
    // The user took over: stop chasing the saved spot.
    cancelAnimationFrame(frame.current);
    if (el.current) write("row:" + name, Math.round(el.current.scrollLeft));
  }, [name]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { ref, onScroll };
}
