import { useSyncExternalStore } from "react";

/**
 * "Recent" photos/videos for the camera screen's library strip — in memory
 * only, for this tab's lifetime.
 *
 * A real photo-library strip (what Instagram/TikTok show) needs OS-level
 * access to the device's camera roll, which no browser exposes to a web
 * page without the person explicitly invoking the system picker first —
 * that's a security boundary, not a gap in this app. So this remembers
 * whatever was captured or picked earlier in this same visit, letting a
 * second use of the same photo skip the picker; it can't show anything from
 * before the system picker was ever opened, and it can't survive a reload,
 * since the object URLs it holds stop working the moment the page is torn
 * down. That's an honest, narrower version of the convention rather than a
 * faked one.
 */
export interface RecentCapture {
  id: string;
  url: string;
  type: "photo" | "video";
  file: File;
}

const MAX_RECENTS = 8;
let recents: RecentCapture[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function addRecentCapture(file: File, type: "photo" | "video"): RecentCapture {
  const entry: RecentCapture = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url: URL.createObjectURL(file),
    type,
    file,
  };
  const next = [entry, ...recents];
  const overflow = next.slice(MAX_RECENTS);
  recents = next.slice(0, MAX_RECENTS);
  // Only revoke what actually fell off the end — everything still in the
  // list, including the one we just added, has to stay valid.
  overflow.forEach((dropped) => URL.revokeObjectURL(dropped.url));
  emit();
  return entry;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => recents;
const serverSnapshot = () => [] as RecentCapture[];

export function useRecentCaptures() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
