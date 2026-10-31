import type { CSSProperties } from "react";
import type { MoodChipId } from "../data/moodCards";

/**
 * The rules behind Discover's Door list (brief of Oct 23, 2026): which issue
 * it is, what the greeting says, and which door is open when you arrive.
 */

/** Soosh launched Sept 1, 2026. */
const LAUNCH = new Date(2026, 8, 1).getTime();
const WEEK = 7 * 24 * 3_600_000;

/** Whole weeks since launch, plus 1. */
export function issueNumber(now: number = Date.now()): number {
  return Math.max(1, Math.floor((now - LAUNCH) / WEEK) + 1);
}


export interface Door {
  greeting: string;
  mood: MoodChipId;
}

/** The greeting and the default door by the viewer's local time (Sun 0 to Sat 6). A viewer with no Moments yet is welcomed in. */
export function doorFor(now: Date, momentCount: number | null): Door {
  if (momentCount === 0) return { greeting: "Welcome in. Pick a door.", mood: "quick" };
  const day = now.getDay();
  const evening = now.getHours() >= 17;
  if (day === 5 && evening) return { greeting: "Friday night. Pick a door.", mood: "people" };
  if (day === 6 && evening) return { greeting: "Saturday night. Pick a door.", mood: "people" };
  if (day === 0 && evening) return { greeting: "Sunday night. Pick a door.", mood: "alone" };
  if (day === 6 || day === 0) return { greeting: "Weekend. Pick a door.", mood: "outside" };
  if (evening) return { greeting: "Evening. Pick a door.", mood: "make" };
  return { greeting: "Got a minute? Pick a door.", mood: "quick" };
}

const LAST_MOOD_KEY = "soosh-last-mood";

/** The mood picked last, if it was within 7 days. */
export function readLastMood(now: number = Date.now()): MoodChipId | null {
  try {
    const raw = localStorage.getItem(LAST_MOOD_KEY);
    if (!raw) return null;
    const { id, at } = JSON.parse(raw) as { id?: MoodChipId; at?: number };
    return id && typeof at === "number" && now - at < WEEK ? id : null;
  } catch {
    return null;
  }
}

export function writeLastMood(id: MoodChipId, now: number = Date.now()) {
  try {
    localStorage.setItem(LAST_MOOD_KEY, JSON.stringify({ id, at: now }));
  } catch {
    /* private mode: the door just opens by the time of day next visit */
  }
}
