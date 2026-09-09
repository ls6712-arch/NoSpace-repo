import { useSyncExternalStore } from "react";
import { LOCAL_CLEARED_EVENT } from "./localData";

/**
 * Profile links — GitHub, a design studio, a Substack, "whatever they want
 * to share." These are meant to be found, not tucked away, so unlike
 * Pursuits (private by default) there's no privacy toggle here: adding one
 * puts it on the public profile. Local-first, same as the rest of the
 * journal layer, so it works instantly with or without an account; a
 * signed-in owner's links are additionally mirrored to Supabase
 * (lib/profileLinksRemote.ts) so a visitor on another device can see them.
 */

const KEY = "nospace.profileLinks.v1";

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
  createdAt: number;
}

interface LinksState {
  links: ProfileLink[];
}

const EMPTY: LinksState = { links: [] };

function load(): LinksState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: LinksState = load();
const listeners = new Set<() => void>();

function commit(next: LinksState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;
const serverSnapshot = () => EMPTY;

if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    state = EMPTY;
    listeners.forEach((l) => l());
  });
}

export function useProfileLinks() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot).links;
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Adds "https://" to a bare domain someone typed without a scheme — the
 * common case for a pasted handle like "github.com/name". */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function addProfileLink(label: string, rawUrl: string): ProfileLink | null {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null; // not a usable URL — caller shows an inline error
  }
  const link: ProfileLink = {
    id: id(),
    label: label.trim() || host,
    url,
    createdAt: Date.now(),
  };
  commit({ links: [link, ...state.links] });
  return link;
}

export function removeProfileLink(linkId: string) {
  commit({ links: state.links.filter((l) => l.id !== linkId) });
}

export function reorderProfileLinks(orderedIds: string[]) {
  const byId = new Map(state.links.map((l) => [l.id, l]));
  const next = orderedIds.map((i) => byId.get(i)).filter((l): l is ProfileLink => !!l);
  // Anything not in orderedIds (shouldn't happen) stays, appended at the end.
  const missing = state.links.filter((l) => !orderedIds.includes(l.id));
  commit({ links: [...next, ...missing] });
}
