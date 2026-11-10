import * as T from "three";

/** The light of the room at a time of day. "clock" is not a mood of its own: it picks one of these from the viewer's hour. */
export type MoodName = "morning" | "golden" | "night";
export type MoodChoice = MoodName | "clock";

interface MoodDef {
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  fog: number;
  bg: number;
  skyTop: number;
  skyBottom: number;
  shaft: number;
  dust: number;
  lamp: number;
  kiln: number;
  exposure: number;
  rain: number;
  glow: number;
  window: number;
}

export const MOODS: Record<MoodName, MoodDef> = {
  golden: { sun: 0xffb46b, sunI: 2.3, hemiSky: 0xffd9b0, hemiGround: 0x4a3326, hemiI: 0.5, fog: 0x2a1d17, bg: 0x1e1511, skyTop: 0xe98c4a, skyBottom: 0xffe0a8, shaft: 0.17, dust: 0.85, lamp: 0.35, kiln: 0.7, exposure: 1, rain: 0, glow: 0xffcf94, window: 0.55 },
  morning: { sun: 0xfff1dc, sunI: 1.8, hemiSky: 0xe2ebf5, hemiGround: 0x5a4a3c, hemiI: 0.75, fog: 0x3a3430, bg: 0x2b2724, skyTop: 0x8fbde6, skyBottom: 0xeef4f6, shaft: 0.1, dust: 0.5, lamp: 0, kiln: 0.35, exposure: 1.05, rain: 0, glow: 0xeaf3ff, window: 0.4 },
  night: { sun: 0x6f86c9, sunI: 0.3, hemiSky: 0x33416b, hemiGround: 0x1a1420, hemiI: 0.32, fog: 0x120f18, bg: 0x0d0b12, skyTop: 0x070c22, skyBottom: 0x24305a, shaft: 0, dust: 0.22, lamp: 1.6, kiln: 1.6, exposure: 1, rain: 0.55, glow: 0x7f93d6, window: 0.18 },
};

const COLOR_KEYS = ["sun", "hemiSky", "hemiGround", "fog", "bg", "skyTop", "skyBottom", "glow"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];
type NumberKey = Exclude<keyof MoodDef, ColorKey>;

/** A mood with its colours as objects, so one state can ease towards another. */
export type MoodState = { [K in ColorKey]: T.Color } & { [K in NumberKey]: number };

export function moodState(name: MoodName): MoodState {
  const d = MOODS[name];
  const out = { ...d } as unknown as MoodState;
  for (const k of COLOR_KEYS) out[k] = new T.Color(d[k]);
  return out;
}

/** Moves `cur` a fraction `k` of the way to `target`. */
export function easeMood(cur: MoodState, target: MoodState, k: number) {
  for (const key of Object.keys(cur) as (keyof MoodState)[]) {
    const c = cur[key];
    const t = target[key];
    if (c instanceof T.Color) c.lerp(t as T.Color, k);
    else (cur[key] as number) = c + ((t as number) - c) * k;
  }
}
