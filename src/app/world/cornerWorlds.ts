import { canonicalCorner } from "../data/hobbies";
import { plural } from "../lib/plural";

/**
 * Which Corners have a room, and the words a room shows. A Corner with a room
 * opens as the room: that is what the Corner looks like. The same Corner as a
 * list (the page every other Corner has) is one tap away, and is what visitors
 * and devices that cannot draw the room get.
 *
 * This file is small and has no 3D in it, so the Corner page can import it to
 * decide which to show. The scene itself (./scene, with three.js) is loaded
 * only when a room opens.
 *
 * To give another Corner a world, see docs/corner-worlds.md.
 */

export interface CornerWorldDef {
  /** The Corner, as `space-slug/corner-slug`. */
  key: string;
  /** The line on the entry screen, under the Corner's name. */
  intro: string;
  /** Read out for the canvas. */
  stageLabel: string;
}

const WORLDS: CornerWorldDef[] = [
  {
    key: "crafts-making/pottery",
    intro: "The wheel is spinning and three potters are at work. Come make something, finished or not.",
    stageLabel: "The Pottery Corner as a 3D room. Drag to look around. Everything in it is also in the Walls panel.",
  },
];

/** The world of a Corner, if it has one. A Corner merged into another uses the kept Corner's world. */
export function cornerWorld(spaceSlug: string, slug: string): CornerWorldDef | undefined {
  const k = canonicalCorner(spaceSlug, slug);
  return WORLDS.find((w) => w.key === `${k.spaceSlug}/${k.slug}`);
}

/** Proposed wording (brief of Nov 10, 2026), listed in docs/glossary.md for the founder's approval. */
export const WORLD_COPY = {
  entryHint: "Best with sound on. Drag to look around.",
  enter: "Enter the Corner",
  /** The two ways to see a Corner that has a room. */
  room: "Room",
  list: "List",
  back: "Back",
  yourShelf: "Your shelf",
  yourShelfEmpty: "Empty for now",
  yourShelfNothing: "Nothing yet. Log a Moment and your piece appears in the Corner: on the drying rack while you’re still making it, on your shelf once it’s done.",
  yourShelfLine: "Finished pieces sit on your shelf. Pieces in progress dry on the rack.",
  hint: "Tap a sign to see who’s still making, who made it, and your own shelf.",
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
export function signLine(spot: "rack" | "shelf" | "yours", count: number, exact = true): string {
  if (spot === "yours") return count === 0 ? WORLD_COPY.yourShelfEmpty : plural(count, "piece");
  if (!exact) return "";
  return spot === "rack" ? `${count} in progress` : `${count} finished`;
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
