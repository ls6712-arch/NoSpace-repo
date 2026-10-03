import { useSyncExternalStore } from "react";

/**
 * Online / slow-network status for the quiet banner at the top of the app.
 *
 * "Offline" comes from the browser. "Slow" means some request to the
 * backend has been waiting longer than SLOW_AFTER_MS; it's measured by
 * wrapping the Supabase client's fetch (see src/lib/supabase.ts), so it
 * covers every read and save without each call site opting in.
 */
export const SLOW_AFTER_MS = 8000;

export type NetworkState = "online" | "offline" | "slow";

const listeners = new Set<() => void>();
const inFlight = new Map<number, number>(); // request id -> started at
let nextId = 1;
let slow = false;
let slowTimer: number | undefined;

function emit() {
  listeners.forEach((l) => l());
}

function recomputeSlow() {
  const now = Date.now();
  let oldest = Infinity;
  inFlight.forEach((t) => (oldest = Math.min(oldest, t)));
  const nextSlow = oldest !== Infinity && now - oldest >= SLOW_AFTER_MS;
  if (slowTimer !== undefined) window.clearTimeout(slowTimer);
  slowTimer = undefined;
  if (!nextSlow && oldest !== Infinity) {
    slowTimer = window.setTimeout(recomputeSlow, SLOW_AFTER_MS - (now - oldest));
  }
  if (nextSlow !== slow) {
    slow = nextSlow;
    emit();
  }
}

/** A fetch that reports how long backend requests are taking. */
export const trackedFetch: typeof fetch = async (input, init) => {
  const id = nextId++;
  inFlight.set(id, Date.now());
  if (typeof window !== "undefined") recomputeSlow();
  try {
    return await fetch(input, init);
  } finally {
    inFlight.delete(id);
    if (typeof window !== "undefined") recomputeSlow();
  }
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function snapshot(): NetworkState {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return slow ? "slow" : "online";
}

export function useNetworkState(): NetworkState {
  return useSyncExternalStore(subscribe, snapshot, () => "online");
}

