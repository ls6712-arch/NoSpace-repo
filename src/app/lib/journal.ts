import { useCallback, useSyncExternalStore } from "react";
import { Post } from "../data/posts";

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

export interface Project {
  id: string;
  title: string;
  hobbySlug: string;
  subHobby?: string;
  startedAt: number;
  /** Set when the maker marks the project finished. */
  finishedAt?: number;
}

export interface PrivateLog {
  id: string;
  projectId?: string;
  note: string;
  createdAt: number;
}

interface JournalState {
  projects: Project[];
  /** postId → projectId, so an update knows which project it belongs to. */
  entryProject: Record<string, string>;
  privateLogs: PrivateLog[];
  /** Post ids kept for later. */
  saved: number[];
  /** Makers whose work you follow, by name — one-way, no follower count. */
  following: string[];
}

const EMPTY: JournalState = {
  projects: [],
  entryProject: {},
  privateLogs: [],
  saved: [],
  following: [],
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
  hobbySlug: string;
  subHobby?: string;
}): Project {
  const project: Project = { id: id(), startedAt: Date.now(), ...input };
  commit({ ...state, projects: [project, ...state.projects] });
  return project;
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

export function addPrivateLog(note: string, projectId?: string): PrivateLog {
  const entry: PrivateLog = { id: id(), note, projectId, createdAt: Date.now() };
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

export function toggleFollowing(name: string) {
  const following = state.following.includes(name)
    ? state.following.filter((n) => n !== name)
    : [name, ...state.following];
  commit({ ...state, following });
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
