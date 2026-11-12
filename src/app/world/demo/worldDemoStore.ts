/**
 * The world demo (staging only): trails, a bag, keepsakes and a pet.
 *
 * Everything here lives in this browser's localStorage. Nothing is read from
 * or written to the database, so trying the demo on staging cannot touch a
 * real account, a real Moment or anything on the live site.
 */

export type PetKind = "dog" | "cat" | "rabbit";
export type Coat = "yellow" | "peach" | "sage" | "stone";

export interface Pet {
  kind: PetKind;
  coat: Coat;
  name: string;
}

/** One thing a person said they want to do, and how far along its trail they are. */
export interface Thing {
  id: string;
  name: string;
  stopsDone: number;
}

export interface Bag {
  thingId: string;
  when: string;
  withName: string;
}

export interface Keepsake {
  id: string;
  thing: string;
  /** The stop it came from, or null for something done without a bag. */
  stop: string | null;
  detail: string;
  /** A small JPEG data URL, or null when there was no picture. */
  photo: string | null;
  withName: string;
  /** ISO date, YYYY-MM-DD, of the day it was brought home. */
  day: string;
  /** 0 first, 1 from the 3rd, 2 from the 10th, 3 from the 25th of the same thing. */
  form: 0 | 1 | 2 | 3;
}

export interface WorldState {
  pet: Pet | null;
  things: Thing[];
  bag: Bag | null;
  keepsakes: Keepsake[];
}

export const EMPTY_WORLD: WorldState = { pet: null, things: [], bag: null, keepsakes: [] };

export const STORAGE_KEY = "soosh.worldDemo.v1";
export const TRAIL_LENGTH = 5;
/** Keepsakes kept in storage. Pictures are the heavy part, so the oldest drop off. */
export const MAX_KEEPSAKES = 60;

const clean = (text: string) => text.trim().replace(/\s+/g, " ");
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();
const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Splits what someone said into separate things: "learn ramen, start running
 * and read more" gives three. Leading filler such as "I want to" is dropped.
 */
export function thingsFrom(said: string): string[] {
  const parts = clean(said)
    .split(/\s*(?:,|;|\band\b|\n)\s*/i)
    .map((part) => clean(part.replace(/^(i\s+)?(also\s+)?(want|would like|would love|need|hope)\s+to\s+/i, "").replace(/^to\s+/i, "")))
    .filter((part) => part.length > 1);
  const seen: string[] = [];
  for (const part of parts) if (!seen.some((s) => same(s, part))) seen.push(part);
  return seen.slice(0, 8);
}

/** The five stops of a trail for any thing at all. The first one is always small. */
export function stopsFor(thing: string): string[] {
  const t = clean(thing);
  return [
    `Get what you need to ${t}`,
    `${capital(t)} for 15 minutes`,
    `${capital(t)} again, a little longer`,
    `${capital(t)} with someone`,
    `Finish one thing you can show`,
  ];
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function currentStop(thing: Thing): string | null {
  return thing.stopsDone >= TRAIL_LENGTH ? null : stopsFor(thing.name)[thing.stopsDone];
}

export function trailFinished(thing: Thing): boolean {
  return thing.stopsDone >= TRAIL_LENGTH;
}

/** Which form the nth keepsake of the same thing takes (n counts from 1). */
export function formFor(n: number): 0 | 1 | 2 | 3 {
  if (n >= 25) return 3;
  if (n >= 10) return 2;
  if (n >= 3) return 1;
  return 0;
}

export function addThings(state: WorldState, said: string): WorldState {
  const fresh = thingsFrom(said).filter((name) => !state.things.some((t) => same(t.name, name)));
  if (fresh.length === 0) return state;
  return { ...state, things: [...state.things, ...fresh.map((name) => ({ id: newId(), name, stopsDone: 0 }))] };
}

export function packBag(state: WorldState, thingId: string, when: string, withName: string): WorldState {
  if (!state.things.some((t) => t.id === thingId)) return state;
  return { ...state, bag: { thingId, when, withName: clean(withName) } };
}

export function emptyBag(state: WorldState): WorldState {
  return { ...state, bag: null };
}

export interface Brought {
  thing: string;
  detail: string;
  photo: string | null;
  withName: string;
  day: string;
}

/**
 * Brings a keepsake home. If the thing is on a trail, that trail moves on one
 * stop; if it is new ("I did this today"), it is added and its first stop is
 * counted as done. The bag is emptied when it held this thing.
 */
export function bringHome(state: WorldState, brought: Brought): { state: WorldState; keepsake: Keepsake } {
  const name = clean(brought.thing);
  const known = state.things.find((t) => same(t.name, name));
  const thing: Thing = known ?? { id: newId(), name, stopsDone: 0 };
  const stop = currentStop(thing);
  const count = state.keepsakes.filter((k) => same(k.thing, name)).length + 1;
  const keepsake: Keepsake = {
    id: newId(),
    thing: thing.name,
    stop: known ? stop : null,
    detail: clean(brought.detail),
    photo: brought.photo,
    withName: clean(brought.withName),
    day: brought.day,
    form: formFor(count),
  };
  const moved: Thing = { ...thing, stopsDone: Math.min(TRAIL_LENGTH, thing.stopsDone + 1) };
  const things = known ? state.things.map((t) => (t.id === known.id ? moved : t)) : [...state.things, moved];
  const bag = state.bag && state.bag.thingId === thing.id ? null : state.bag;
  const keepsakes = [keepsake, ...state.keepsakes].slice(0, MAX_KEEPSAKES);
  return { state: { ...state, things, bag, keepsakes }, keepsake };
}

/** How many keepsakes came home on the given day. One or more lights the lamp. */
export function broughtHomeOn(state: WorldState, day: string): number {
  return state.keepsakes.filter((k) => k.day === day).length;
}

/** The different things a person has done at least once: the places uncovered so far. */
export function uncovered(state: WorldState): string[] {
  const names: string[] = [];
  for (const k of [...state.keepsakes].reverse()) if (!names.some((n) => same(n, k.thing))) names.push(k.thing);
  return names;
}

export function initials(name: string): string {
  const first = clean(name).charAt(0);
  return first ? `${first.toUpperCase()}.` : "";
}

export function loadWorld(storage: Pick<Storage, "getItem"> | null): WorldState {
  if (!storage) return EMPTY_WORLD;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_WORLD;
    const parsed = JSON.parse(raw) as Partial<WorldState>;
    return {
      pet: parsed.pet ?? null,
      things: Array.isArray(parsed.things) ? parsed.things : [],
      bag: parsed.bag ?? null,
      keepsakes: Array.isArray(parsed.keepsakes) ? parsed.keepsakes : [],
    };
  } catch {
    return EMPTY_WORLD;
  }
}

/**
 * Saves the world. When storage is full (pictures add up), the oldest pictures
 * are dropped until it fits; the keepsakes themselves are kept.
 */
export function saveWorld(storage: Pick<Storage, "setItem"> | null, state: WorldState): WorldState {
  if (!storage) return state;
  let next = state;
  for (let attempt = 0; attempt < MAX_KEEPSAKES + 1; attempt++) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch {
      const oldest = [...next.keepsakes].reverse().find((k) => k.photo);
      if (!oldest) return next;
      next = { ...next, keepsakes: next.keepsakes.map((k) => (k.id === oldest.id ? { ...k, photo: null } : k)) };
    }
  }
  return next;
}
