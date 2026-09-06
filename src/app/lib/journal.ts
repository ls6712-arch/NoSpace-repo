import { useCallback, useSyncExternalStore } from "react";
import { Post } from "../data/posts";
import { LOCAL_CLEARED_EVENT } from "./localData";

/**
 * The journal layer: the concepts NoSpace is actually built around, kept
 * separate from the raw post feed.
 *
 *   Project      a durable body of work you come back to
 *   Update       a new entry on an existing project
 *   Quick moment a short standalone entry that isn't part of a project
 *   Private log  an entry only you ever see
 *   Saved        something you kept to come back to, not a public applause metric
 *
 * This lives in localStorage for now, alongside circle joins and reactions.
 * A `projects` table is the obvious next step; until then everything here is
 * per-browser, and the UI never claims otherwise.
 */

const KEY = "nospace.journal.v1";

/**
 * A Pursuit — something you're bringing to life. User-facing text calls
 * these Pursuits everywhere; the type keeps the name `Project` internally
 * only to avoid a mechanical rename across every existing call site.
 *
 * A Pursuit needs nothing but a name. `hobbySlug` (an existing, real Space)
 * and `interest` (free text, same spirit as a post's own `interest` field)
 * are both optional and independent of each other — naming a Pursuit never
 * forces it into NoSpace's taxonomy. `customSpace` holds a made-up Space
 * name when neither existing Space fits ("Other").
 */
export interface Project {
  id: string;
  title: string;
  hobbySlug?: string;
  subHobby?: string;
  /** Free-text interest, e.g. "Bookbinding" — not required to match a real sub-hobby. */
  interest?: string;
  /** A made-up Space name, used only when no real Space fits. */
  customSpace?: string;
  /** The Try This'd post that inspired this Pursuit, if it started that way. */
  inspiredByPostId?: number;
  /** Private by default. Only a Pursuit explicitly marked shared appears on
   * a public profile — this is a per-Pursuit flag, never an account-wide one. */
  shared?: boolean;
  startedAt: number;
  /** Set when the maker marks the Pursuit finished. */
  finishedAt?: number;
}

export interface PrivateLog {
  id: string;
  projectId?: string;
  note: string;
  /**
   * A private log can be a photo with no words. The capture flow always
   * offered that, but the picture used to be dropped on save and replaced
   * with a generated placeholder, which read as the app losing your moment.
   */
  media?: string;
  mediaType?: "image" | "video";
  hobbySlug?: string;
  createdAt: number;
}

interface JournalState {
  projects: Project[];
  /** postId → projectId, so an update knows which project it belongs to. */
  entryProject: Record<string, string>;
  privateLogs: PrivateLog[];
  /** Post ids kept for later. */
  saved: number[];
}

const EMPTY: JournalState = {
  projects: [],
  entryProject: {},
  privateLogs: [],
  saved: [],
};

function load(): JournalState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: JournalState = load();
const listeners = new Set<() => void>();

function commit(next: JournalState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best effort — a private window shouldn't break logging
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;
const serverSnapshot = () => EMPTY;

// Signing out empties local storage; the in-memory copy has to follow, or the
// previous account's private logs stay on screen until a reload.
if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    state = EMPTY;
    listeners.forEach((l) => l());
  });
}

/** Reads the whole journal. Components pick what they need off it. */
export function useJournal() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Narrower read for components that only care about one slice. */
export function useJournalSlice<T>(select: (s: JournalState) => T): T {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => select(state), [select]),
    useCallback(() => select(EMPTY), [select]),
  );
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function startProject(input: {
  title: string;
  hobbySlug?: string;
  subHobby?: string;
  interest?: string;
  customSpace?: string;
  inspiredByPostId?: number;
  shared?: boolean;
}): Project {
  const project: Project = { id: id(), startedAt: Date.now(), ...input };
  commit({ ...state, projects: [project, ...state.projects] });
  return project;
}

/** Sharing is set per Pursuit, on purpose — never a switch that publishes
 * everything you've ever started. */
export function setProjectShared(projectId: string, shared: boolean) {
  commit({
    ...state,
    projects: state.projects.map((p) => (p.id === projectId ? { ...p, shared } : p)),
  });
}

/** How far along a Pursuit is, and when it last moved — derived from the
 * posts actually attached to it rather than a separate status field, so
 * there's nothing to keep in sync by hand. */
export function projectProgress(
  entryProject: Record<string, string>,
  posts: Post[],
  projectId: string,
) {
  const updates = posts
    .filter((p) => entryProject[String(p.id)] === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return { updates, count: updates.length, lastUpdatedAt: updates[0]?.createdAt };
}

/** Files a logged entry under a project, so it reads as an update rather than a one-off. */
export function attachEntry(postId: number | string, projectId: string) {
  commit({
    ...state,
    entryProject: { ...state.entryProject, [String(postId)]: projectId },
  });
}

export function finishProject(projectId: string) {
  commit({
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, finishedAt: Date.now() } : p,
    ),
  });
}

export function addPrivateLog(
  note: string,
  projectId?: string,
  media?: { url: string; type: "image" | "video"; hobbySlug?: string },
): PrivateLog {
  const entry: PrivateLog = {
    id: id(),
    note,
    projectId,
    media: media?.url,
    mediaType: media?.type,
    hobbySlug: media?.hobbySlug,
    createdAt: Date.now(),
  };
  commit({ ...state, privateLogs: [entry, ...state.privateLogs] });
  return entry;
}

export function removePrivateLog(logId: string) {
  commit({ ...state, privateLogs: state.privateLogs.filter((l) => l.id !== logId) });
}

export function toggleSaved(postId: number) {
  const saved = state.saved.includes(postId)
    ? state.saved.filter((s) => s !== postId)
    : [postId, ...state.saved];
  commit({ ...state, saved });
}

export function isSaved(postId: number) {
  return state.saved.includes(postId);
}

/**
 * Everyone else's work, grouped into projects the same way yours is: one
 * maker, one hobby, more than a single entry. This is what lets the rest of
 * the app talk about other people's *projects* honestly rather than
 * relabelling isolated posts.
 */
export interface DerivedProject {
  key: string;
  title: string;
  creator: string;
  hobbySlug: string;
  subHobby?: string;
  updates: Post[];
  lastUpdatedAt: number;
}

export function deriveProjects(posts: Post[], subHobbyLabel: (s: string) => string | undefined) {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const key = `${post.creator}::${post.subHobby ?? post.hobbySlug}`;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  const out: DerivedProject[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue; // one entry is a quick moment, not a project
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const first = sorted[0];
    const label = first.subHobby ? subHobbyLabel(first.subHobby) : undefined;
    out.push({
      key,
      title: label ?? "Ongoing work",
      creator: first.creator,
      hobbySlug: first.hobbySlug,
      subHobby: first.subHobby,
      updates: sorted,
      lastUpdatedAt: first.createdAt,
    });
  }
  return out.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
}

/** Days since a project last moved — drives the gentle nudge on My Space. */
export function daysSince(ms: number) {
  return Math.floor((Date.now() - ms) / 86_400_000);
}
