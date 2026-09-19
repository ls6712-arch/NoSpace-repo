import { useCallback, useSyncExternalStore } from "react";
import { LOCAL_CLEARED_EVENT } from "./localData";

/**
 * Your own private note per Corner — one short line, shown on that Corner's
 * Moments tile. Personal, not a Corner's shared/public description
 * (CornersContext's `Corner.description`, set by whoever created the Corner
 * and visible to everyone): this is "Your Moments," so a note here is your
 * own record about your own Ceramics, not something anyone else sees.
 *
 * Local-first, same spirit as journal.ts: this lives in localStorage for
 * now, keyed the same way a Corner's tally key already is elsewhere
 * (subHobby slug, or `space:<hobbySlug>` for the untagged bucket). A
 * per-user Supabase table is the obvious next step if this needs to survive
 * a sign-in on a different device — until then it's per-browser, and
 * nothing here claims otherwise.
 */
const KEY = "sushii.cornerNotes.v1";
const MAX_LENGTH = 140;

type NotesState = Record<string, string>;

function load(): NotesState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NotesState) : {};
  } catch {
    return {};
  }
}

let state: NotesState = load();
const listeners = new Set<() => void>();

function commit(next: NotesState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best effort — a private window shouldn't break the rest of the page
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    state = {};
    listeners.forEach((l) => l());
  });
}

/** The note for one Corner, or "" if none was ever written. */
export function useCornerNote(key: string): string {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => state[key] ?? "", [key]),
    useCallback(() => "", []),
  );
}

export function setCornerNote(key: string, text: string) {
  const trimmed = text.trim().slice(0, MAX_LENGTH);
  const next = { ...state };
  if (trimmed) next[key] = trimmed;
  else delete next[key];
  commit(next);
}
