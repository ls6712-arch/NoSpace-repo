import { canonicalCorner } from "../data/hobbies";
import { plural } from "../lib/plural";
import type { CornerWorldConfig } from "./config";
import { CORNER_WORLDS } from "./corners";

/**
 * Which Corners have a room, and the words every room shares. A Corner with a room opens as the room: that is
 * what the Corner looks like. The same Corner as a list (the page every other Corner has) is one tap away,
 * and is what visitors and devices that cannot draw the room get.
 *
 * This file is small and has no 3D in it, so the Corner page can import it to decide which to show. The
 * engine itself (./core/scene, with three.js) is loaded only when a room opens.
 *
 * A room is a config: ./corners. To give another Corner a room, see docs/corner-worlds.md.
 */

/** A Corner's room. The old name for a config, kept for the pages that take one. */
export type CornerWorldDef = CornerWorldConfig;

/** The room of a Corner, if it has one. A Corner merged into another uses the kept Corner's room. */
export function cornerWorld(spaceSlug: string, slug: string): CornerWorldConfig | undefined {
  const k = canonicalCorner(spaceSlug, slug);
  return CORNER_WORLDS.find((w) => w.key === `${k.spaceSlug}/${k.slug}`);
}

/** Words every room shares. A Corner's own words (its entry line, its wall names, its shelf notes) are in its config. */
export const WORLD_COPY = {
  entryHint: "Best with sound on. Drag to look around.",
  enter: "Enter the Corner",
  /** The two ways to see a Corner that has a room. */
  room: "Room",
  list: "List",
  back: "Back",
  yourShelf: "Your shelf",
  yourShelfEmpty: "Empty for now",
  gotIt: "Got it",
  character: "Character",
  timeOfDay: "Time of day",
  moods: { morning: "Morning", golden: "Golden hour", night: "Night rain", clock: "My clock" },
  soundOn: "Sound on",
  soundOff: "Sound off",
  musicOn: "Music on",
  musicOff: "Music off",
  cantOpen: "This device can’t open the room, so here is the list.",
} as const;

/** The line under a sign: how many pieces, never how many people. Nothing when the number is not known exactly. */
export function signLine(config: CornerWorldConfig, spot: "rack" | "shelf" | "yours", count: number, exact = true): string {
  if (spot === "yours") return count === 0 ? WORLD_COPY.yourShelfEmpty : plural(count, "piece");
  if (!exact) return "";
  return `${count} ${spot === "rack" ? config.copy.walls.still.sub : config.copy.walls.made.sub}`;
}

/** Whether this browser can draw a world at all. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Sound, music, time of day and the one-time hint, remembered for one person in this browser. */
export interface WorldPrefs {
  mood: "morning" | "golden" | "night" | "clock";
  sound: boolean;
  music: boolean;
  hintSeen: boolean;
  /** How this person last chose to see a Corner that has a room. The room unless they chose the list. */
  view: "room" | "list";
}

const DEFAULT_PREFS: WorldPrefs = { mood: "clock", sound: true, music: true, hintSeen: false, view: "room" };
const prefsKey = (userId: string) => `soosh.world.${userId}`;

export function readWorldPrefs(userId: string): WorldPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(prefsKey(userId)) ?? "{}") as Partial<WorldPrefs>;
    return {
      mood: raw.mood === "morning" || raw.mood === "golden" || raw.mood === "night" ? raw.mood : "clock",
      sound: raw.sound !== false,
      music: raw.music !== false,
      hintSeen: raw.hintSeen === true,
      view: raw.view === "list" ? "list" : "room",
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writeWorldPrefs(userId: string, prefs: WorldPrefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch {
    /* storage can be blocked */
  }
}

// A room that could not open on this device (no WebGL, a lost graphics context, a first frame that took too
// long) is not tried again by itself until the tab is closed. Asking for the room again clears it.
const UNAVAILABLE_KEY = "soosh.world.unavailable";

export function roomUnavailable(): boolean {
  try {
    return sessionStorage.getItem(UNAVAILABLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRoomUnavailable(unavailable: boolean) {
  try {
    if (unavailable) sessionStorage.setItem(UNAVAILABLE_KEY, "1");
    else sessionStorage.removeItem(UNAVAILABLE_KEY);
  } catch {
    /* storage can be blocked */
  }
}

/**
 * Whether a Corner opens as its room for this person: it has one, they are an approved member, they did not
 * choose the list, and the room has not just failed on this device.
 */
export function opensAsRoom(o: { hasRoom: boolean; member: boolean; view: "room" | "list"; unavailable: boolean }): boolean {
  return o.hasRoom && o.member && o.view === "room" && !o.unavailable;
}
