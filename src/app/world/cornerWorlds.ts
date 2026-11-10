import { canonicalCorner } from "../data/hobbies";
import { plural } from "../lib/plural";

/**
 * Which Corners have a world, and the words a world shows. This file is small
 * and has no 3D in it, so the Corner page can import it to decide whether to
 * offer the way in. The scene itself (./scene, with three.js) is loaded only
 * when someone opens a world.
 *
 * To give another Corner a world, see docs/corner-worlds.md.
 */

export interface CornerWorldDef {
  /** The Corner, as `space-slug/corner-slug`. */
  key: string;
  /** The button on the Corner page. */
  enter: string;
  /** The entry screen. */
  title: string;
  intro: string;
  /** Read out for the canvas. */
  stageLabel: string;
}

const WORLDS: CornerWorldDef[] = [
  {
    key: "crafts-making/pottery",
    enter: "Enter the studio",
    title: "The Pottery studio",
    intro: "The wheel is spinning and three potters are at work. Come make something, finished or not.",
    stageLabel: "A pottery studio in 3D. Drag to look around. Everything in it is also in the Walls panel.",
  },
];

/** The world of a Corner, if it has one. A Corner merged into another uses the kept Corner's world. */
export function cornerWorld(spaceSlug: string, slug: string): CornerWorldDef | undefined {
  const k = canonicalCorner(spaceSlug, slug);
  return WORLDS.find((w) => w.key === `${k.spaceSlug}/${k.slug}`);
}

export function worldPath(slug: string): string {
  return `/corners/${slug}/world`;
}

/** Proposed wording (brief of Nov 10, 2026), listed in docs/glossary.md for the founder's approval. */
export const WORLD_COPY = {
  entryHint: "Best with sound on. Drag to look around.",
  leave: "Leave the studio",
  yourShelf: "Your shelf",
  yourShelfEmpty: "Empty for now",
  yourShelfNothing: "Nothing yet. Log a Moment and your piece appears in the studio: on the drying rack while you’re still making it, on your shelf once it’s done.",
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
  cantOpen: "The studio can’t open on this device, so here is the Corner page.",
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
}

const DEFAULT_PREFS: WorldPrefs = { mood: "clock", sound: true, music: true, hintSeen: false };
const prefsKey = (userId: string) => `soosh.world.${userId}`;

export function readWorldPrefs(userId: string): WorldPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(prefsKey(userId)) ?? "{}") as Partial<WorldPrefs>;
    return {
      mood: raw.mood === "morning" || raw.mood === "golden" || raw.mood === "night" ? raw.mood : "clock",
      sound: raw.sound !== false,
      music: raw.music !== false,
      hintSeen: raw.hintSeen === true,
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
