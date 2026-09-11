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
 *   Saved        something you kept to come back to, not a public applause metric
 *
 * This lives in localStorage for now, alongside circle joins and reactions.
 * A `projects` table is the obvious next step; until then everything here is
 * per-browser, and the UI never claims otherwise.
 *
 * Private logs used to be a fourth concept here ("an entry only you ever
 * see") but have since moved to their own Supabase-backed table and
 * context — see lib/privateLogsRemote.ts and context/PrivateLogsContext.tsx
 * — because "only you ever see" is a promise localStorage can't actually
 * keep across accounts on a shared device. This file no longer touches
 * them; an old `privateLogs` array may still exist under this module's
 * localStorage key from before that move, left alone pending a separate
 * migration decision.
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
/**
 * A Goal — one optional, narrower thing attached to a Pursuit. Deliberately
 * not scorekeeping: no percentages are derived anywhere from this, and the
 * "feeling" shape exists so a Pursuit never has to be quantified to have a
 * goal. Only one goal is ever active on a Pursuit at a time; setting a new
 * one archives whatever was there before rather than deleting it.
 */
export type GoalShape = "number" | "date" | "feeling";

export interface Goal {
  id: string;
  shape: GoalShape;
  /** What shows on the Pursuit card, e.g. "Finish 10 pieces" — editable,
   * pre-filled from the other fields but never regenerated after that. */
  label: string;
  /** shape: "number" */
  targetNumber?: number;
  unit?: string;
  current?: number;
  /** shape: "date" */
  targetDate?: number;
  createdAt: number;
  /** Set when the maker marks the goal reached — "Reached it," not
   * "completed," and never turned into a pass/fail state. */
  reachedAt?: number;
}

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
  /** The one active goal, if the maker set one. */
  goal?: Goal;
  /** Replaced goals, kept rather than deleted — see setProjectGoal. */
  pastGoals?: Goal[];
}

interface JournalState {
  projects: Project[];
  /** postId → projectId, so an update knows which project it belongs to. */
  entryProject: Record<string, string>;
  /** Post ids kept for later. */
  saved: number[];
}

const EMPTY: JournalState = {
  projects: [],
  entryProject: {},
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
 * there's nothing to keep in sync by hand.
 *
 * A post counts as an update on this Pursuit if either signal says so: its
 * own pursuitId (mirrored to the database — see sql/pursuit-updates.sql and
 * attachPostToPursuit — so it's visible from any device, or to anyone else
 * the Pursuit is shared with), or the local entryProject map (instant,
 * works offline, and still the only record for posts attached before
 * pursuitId existed). Checking both means neither an older local-only
 * attachment nor a freshly-synced one gets missed. */
export function projectProgress(
  entryProject: Record<string, string>,
  posts: Post[],
  projectId: string,
) {
  const updates = posts
    .filter((p) => p.pursuitId === projectId || entryProject[String(p.id)] === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return { updates, count: updates.length, lastUpdatedAt: updates[0]?.createdAt };
}

/** Files a logged entry under a project, so it reads as an update rather than a one-off. */
export function attachEntry(postId: number | string, projectId: string) {
  commit({
    ...state,
    entryProject: { ...state.entryProject, [String(postId)]: projectId },
    // Logging a new Update against a Pursuit that was marked finished means
    // you're back at it — reopen it automatically rather than silently
    // filing the Update against something that still reads as done.
    projects: state.projects.map((p) =>
      p.id === projectId && p.finishedAt ? { ...p, finishedAt: undefined } : p,
    ),
  });
}

/**
 * Sets (or replaces) a Pursuit's active goal. A goal that's being replaced
 * moves to `pastGoals` instead of vanishing — declaring something and then
 * losing it silently is the same trust problem as a dropped draft elsewhere
 * in the app.
 */
export function setProjectGoal(projectId: string, goal: Omit<Goal, "id" | "createdAt">) {
  commit({
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const archived = p.goal ? [p.goal, ...(p.pastGoals ?? [])] : (p.pastGoals ?? []);
      return {
        ...p,
        goal: { ...goal, id: id(), createdAt: Date.now() },
        pastGoals: archived,
      };
    }),
  });
}

/** Removes the active goal with no confirmation required — goals are
 * low-stakes, and archiving already protects against real loss. */
export function removeProjectGoal(projectId: string) {
  commit({
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId || !p.goal) return p;
      return { ...p, goal: undefined, pastGoals: [p.goal, ...(p.pastGoals ?? [])] };
    }),
  });
}

/** "Reached it" — the one completion verb, no pass/fail framing. */
export function markGoalReached(projectId: string) {
  commit({
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId && p.goal ? { ...p, goal: { ...p.goal, reachedAt: Date.now() } } : p,
    ),
  });
}

/** Bumps a numeric goal's progress by a fixed amount (used by "+1" on the
 * Pursuit card). Never exceeds the target in the stored value's display,
 * though the raw count is kept as-is rather than clamped, so a maker who
 * overshoots still sees their real number. */
export function bumpGoalProgress(projectId: string, delta: number) {
  commit({
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId && p.goal
        ? { ...p, goal: { ...p.goal, current: Math.max(0, (p.goal.current ?? 0) + delta) } }
        : p,
    ),
  });
}

/** Plain-language progress for a numeric goal — "3 of 10 pieces," never a
 * percentage, which reads as scorekeeping the brand explicitly avoids. */
export function goalProgressText(goal: Goal): string | undefined {
  if (goal.shape !== "number" || goal.targetNumber == null) return undefined;
  const current = goal.current ?? 0;
  return `${current} of ${goal.targetNumber}${goal.unit ? ` ${goal.unit}` : ""}`;
}

export function finishProject(projectId: string) {
  commit({
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, finishedAt: Date.now() } : p,
    ),
  });
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
