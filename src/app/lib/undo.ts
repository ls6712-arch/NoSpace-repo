import { toast } from "sonner";
import { track } from "./analytics";

/**
 * Nothing on the calendar asks "are you sure". A change is made on screen at
 * once and the toast offers Undo for 6 seconds. A change that others would
 * feel (cancelling or leaving a plan) is only sent after the 6 seconds, so an
 * Undo costs them nothing: `commit` runs when the time is up, `undo` when
 * Undo is tapped.
 *
 * Such a change also waits in this browser's storage (`persist`), so closing the
 * tab, a crash or a lost connection cannot lose it: leaving the page tries to send
 * it at once (a closing page may cut that short), and the next load sends
 * anything whose 6 seconds have passed. Nothing is sent from storage before its
 * 6 seconds. Sending twice is harmless: every change that waits is safe to repeat.
 */
export const UNDO_MS = 6000;
export const UNDO_LABEL = "Undo";
export const PENDING_KEY = "soosh.calendar.pending.v1";

/** What is needed to send a change later, in plain data (a function cannot be stored). */
export interface PersistedChange {
  type: string;
  userId: string;
  payload: Record<string, unknown>;
}

export interface QueuedChange extends PersistedChange {
  key: string;
  /** When its 6 seconds are up, in milliseconds. */
  dueAt: number;
}

const store = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function readQueue(s: Pick<Storage, "getItem"> | null = store()): QueuedChange[] {
  try {
    const raw = JSON.parse(s?.getItem(PENDING_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e): e is QueuedChange => !!e && typeof e.key === "string" && typeof e.type === "string" && typeof e.userId === "string" && typeof e.dueAt === "number" && !!e.payload && typeof e.payload === "object",
    );
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedChange[], s: Pick<Storage, "setItem" | "removeItem"> | null = store()): void {
  try {
    if (queue.length === 0) s?.removeItem(PENDING_KEY);
    else s?.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch {
    // Private mode or a full store: the change still goes after its 6 seconds while the page is open.
  }
}

const dequeue = (key: string) => writeQueue(readQueue().filter((e) => e.key !== key));

/** Changes in this page still inside their 6 seconds. */
const waiting = new Map<string, () => void>();
let counter = 0;

export function announceChange(message: string, handlers: { undo: () => void; commit?: () => void | Promise<unknown>; persist?: PersistedChange }): void {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const key = `${Date.now().toString(36)}-${(counter++).toString(36)}`;
  const send = (leaveQueued: boolean) => {
    if (settled) return;
    settled = true;
    waiting.delete(key);
    if (timer) clearTimeout(timer);
    // Leaving the page cannot tell whether the send got through, so it stays queued and the next load repeats it.
    Promise.resolve(handlers.commit?.())
      .catch(() => undefined)
      .finally(() => {
        if (!leaveQueued) dequeue(key);
      });
  };
  if (handlers.commit) {
    waiting.set(key, () => send(true));
    timer = setTimeout(() => send(false), UNDO_MS);
    if (handlers.persist) writeQueue([...readQueue(), { ...handlers.persist, key, dueAt: Date.now() + UNDO_MS }]);
  }
  toast(message, {
    duration: UNDO_MS,
    action: {
      label: UNDO_LABEL,
      onClick: () => {
        if (settled) return;
        settled = true;
        waiting.delete(key);
        if (timer) clearTimeout(timer);
        dequeue(key);
        track({ name: "undo_used" });
        handlers.undo();
      },
    },
  });
}

/** Sends every change still inside its 6 seconds, now. For leaving the page. */
export function flushPendingChanges(): void {
  for (const send of [...waiting.values()]) send();
}

const resumed = new Set<string>();

/**
 * On a new load: sends what an earlier page left waiting once its 6 seconds are up
 * (at once if they already are, otherwise when they are). Only this person's, and
 * never anything this page is itself still holding. `run` must be safe to repeat.
 */
export function resumePendingChanges(userId: string, run: (change: PersistedChange) => Promise<unknown>, now = Date.now()): void {
  for (const e of readQueue()) {
    if (e.userId !== userId || waiting.has(e.key) || resumed.has(e.key)) continue;
    resumed.add(e.key);
    const go = () => {
      void run(e)
        .catch(() => undefined)
        .finally(() => dequeue(e.key));
    };
    if (e.dueAt <= now) go();
    else setTimeout(go, e.dueAt - now);
  }
}

// Closing the tab sends what is waiting. `pagehide` covers a tab or window closing and a page being left; `visibilitychange` covers a phone
// putting the page away, where `pagehide` can be skipped.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingChanges);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingChanges();
  });
}
