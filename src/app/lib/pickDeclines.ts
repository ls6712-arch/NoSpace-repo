import { useCallback, useState } from "react";

/**
 * "Not this" on Stubby's picks. Kept in memory and in this browser only
 * (localStorage), never sent anywhere: a pick, a Keep or a Not this is not
 * logged until the Privacy Policy line about suggestion logging is published.
 * Keyed by the free stretch ("2026-11-03:tue-eve"), so each stretch counts its own.
 */
export type Declines = Record<string, string[]>;
export const DECLINES_KEY = "soosh.calendar.notthis.v1";

const store = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** What was saved, without stretches from before `today` ("2026-11-03") and without anything that is not a list of ids. */
export function loadDeclines(today: string, s: Pick<Storage, "getItem"> | null = store()): Declines {
  try {
    const raw = JSON.parse(s?.getItem(DECLINES_KEY) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Declines = {};
    for (const [key, ids] of Object.entries(raw as Record<string, unknown>)) {
      if (key.slice(0, 10) < today || !Array.isArray(ids)) continue;
      const list = ids.filter((x): x is string => typeof x === "string").slice(0, 20);
      if (list.length > 0) out[key] = list;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDeclines(d: Declines, s: Pick<Storage, "setItem"> | null = store()): void {
  try {
    s?.setItem(DECLINES_KEY, JSON.stringify(d));
  } catch {
    // Private mode or a full store: the choices last until the page closes.
  }
}

export const withDecline = (d: Declines, slotKey: string, id: string): Declines => (d[slotKey]?.includes(id) ? d : { ...d, [slotKey]: [...(d[slotKey] ?? []), id] });

export function usePickDeclines(today: string): { declines: Declines; notThis: (slotKey: string, id: string) => void } {
  const [declines, setDeclines] = useState<Declines>(() => loadDeclines(today));
  const notThis = useCallback((slotKey: string, id: string) => {
    setDeclines((d) => {
      const next = withDecline(d, slotKey, id);
      if (next !== d) saveDeclines(next);
      return next;
    });
  }, []);
  return { declines, notThis };
}
