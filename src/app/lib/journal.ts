import { useCallback, useSyncExternalStore } from "react";
import { Post } from "../data/posts";
import { LOCAL_CLEARED_EVENT } from "./localData";

/**
 * The journal layer: the concepts Sushii is actually built around, kept
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

const KEY = "sushii.journal.v1";

/**
 * A Pursuit — something you're bringing to life. User-facing text calls
 * these Pursuits everywhere; the type keeps the name `Project` internally
 * only to avoid a mechanical rename across every existing call site.
 *
 * A Pursuit needs nothing but a name. `hobbySlug` (an existing, real Space)
 * and `interest` (free text, same spirit as a post's own `interest` field)
 * are both optional and independent of each other — naming a Pursuit never
 * forces it into Sushii's taxonomy. `customSpace` holds a made-up Space
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
  /** What the tap-to-log button reads, e.g. "Finished one" — a number goal
   * only; defaults to "Finished one" when unset. */
  verb?: string;
  /** An optional deadline. Its own shape ("date") is what makes this the
   * whole goal and drives `label`; a "number" goal can also carry one as a
   * secondary "by when," shown alongside its count rather than instead of it. */
  targetDate?: number;
  createdAt: number;
  /** Set when the maker marks the goal reached — "Reached it," not
   * "completed," and never turned into a pass/fail state. */
  reachedAt?: number;
}

/**
 * How a Pursuit's progress adds up — chosen when it's created (the "How
 * should progress add up?" step). Every Moment can carry an amount toward
 * `target`; progress is startingAmount plus the sum of those amounts.
 */
export type MeasureKind = "count" | "quantity" | "time" | "milestones" | "custom";

export interface Measure {
  kind: MeasureKind;
  /** The target amount, e.g. 20000. For "milestones" it's the number of milestones. */
  target: number;
  /** Plural unit name, e.g. "words", "paintings", "hours". */
  unit: string;
  /** "What counts as one?" — free text, shown on the Pursuit. */
  whatCounts?: string;
  allowPartial: boolean;
  allowDecimals: boolean;
  /** Pre-filled amount on each new Moment. */
  defaultAmount: number;
  /** Progress already made before starting on Sushii. */
  startingAmount: number;
  targetDate?: number;
  /** Named milestones, for kind === "milestones". */
  milestones?: string[];
}

/** solo — just you. together — everyone has their own goal and journey,
 * side by side ("Paint together"). group — one shared goal everyone
 * contributes to ("Community mural"). */
export type PursuitMode = "solo" | "together" | "group";

export interface PursuitMember {
  userId?: string;
  username?: string | null;
  displayName: string;
  avatarUrl?: string;
  status: "invited" | "joined" | "declined";
  /** Owner is also listed, so every view can iterate one list. */
  role: "owner" | "member";
}

/** One amount logged toward a Pursuit — by a Moment, or a bare tap. */
export interface ProgressEntry {
  id: string;
  projectId: string;
  amount: number;
  createdAt: number;
  /** Who logged it. Undefined = this browser's own maker (signed out). */
  userId?: string;
  postId?: number | string;
  logId?: number;
  note?: string;
  image?: string;
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
  /** Set when the maker chose to rest this Pursuit — "Pausing for now."
   * A third state beside active and finished, so stepping away is a
   * decision rather than a silent failure. Cleared by resumeProject or by
   * logging a new Moment against it. */
  pausedAt?: number;
  /** How often the maker asked to be checked in on, in days. The only
   * reminder this Pursuit ever gets is one they set themselves. 0 means
   * "never"; undefined means they haven't chosen, which falls back to
   * DEFAULT_CHECK_IN_DAYS. */
  checkInDays?: number;
  /** When the last check-in was answered or dismissed — the next one waits
   * a full interval from here, so ignoring one never produces another the
   * next day. */
  checkInAnsweredAt?: number;
  /** How many check-ins in a row went unanswered. After two, Sushii stops
   * asking rather than escalating. */
  checkInsIgnored?: number;
  /** The answer to "What would you tell yourself on day one?" — asked once,
   * when the Pursuit is marked complete. Shown at the top of it from then on. */
  endingNote?: string;
  /** How progress adds up. Pursuits made before measures existed have none
   * and fall back to their `goal`, if any. */
  measure?: Measure;
  mode?: PursuitMode;
  members?: PursuitMember[];
  /** Set on a Pursuit someone else created and invited you into. */
  ownerId?: string;
  role?: "owner" | "member";
}

/** The check-in interval used when the maker hasn't picked one. Two weeks:
 * long enough that it never reads as a streak. */
export const DEFAULT_CHECK_IN_DAYS = 14;

/** The cadences a maker can pick from — creation dialog and Pursuit page alike. */
export const CHECK_IN_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "Monthly" },
  { days: 0, label: "Never" },
];

/** A Pursuit's state, derived — never stored as its own field, so it can't
 * disagree with finishedAt/pausedAt. */
export type PursuitStatus = "active" | "resting" | "complete";

export function pursuitStatus(p: Pick<Project, "finishedAt" | "pausedAt">): PursuitStatus {
  if (p.finishedAt) return "complete";
  if (p.pausedAt) return "resting";
  return "active";
}

interface JournalState {
  projects: Project[];
  /** postId → projectId, so an update knows which project it belongs to. */
  entryProject: Record<string, string>;
  /** Post ids kept for later. */
  saved: number[];
  /** projectId → the amount logged on each tap, in order — what
   * undoLastProgress pops from to undo a mis-tap without a form. */
  progressHistory: Record<string, number[]>;
  /** Amounts logged toward measured Pursuits, newest last. */
  progress: ProgressEntry[];
}

const EMPTY: JournalState = {
  projects: [],
  entryProject: {},
  saved: [],
  progressHistory: {},
  progress: [],
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
  measure?: Measure;
  mode?: PursuitMode;
  members?: PursuitMember[];
  checkInDays?: number;
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
    // Same for a resting one: a new Moment is the clearest possible sign
    // it's moving again. It also counts as answering any open check-in.
    projects: state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            finishedAt: undefined,
            pausedAt: undefined,
            checkInAnsweredAt: Date.now(),
            checkInsIgnored: 0,
          }
        : p,
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

/**
 * Logs progress toward a numeric goal — the tap-to-log interaction: one tap
 * is the log, immediately, no form. Clamped to the target so a burst of
 * taps (or a held +1) can't overshoot; a small history is kept per project
 * so a mis-tap can be undone rather than requiring the number to be
 * corrected by hand. Returns the updated Project (for the caller to mirror
 * to Supabase — see pursuitsRemote.ts's mirrorPursuit) or undefined if
 * projectId doesn't match a Pursuit with a number goal.
 */
export function logProgress(projectId: string, amount: number): Project | undefined {
  let updated: Project | undefined;
  const projects = state.projects.map((p) => {
    if (p.id !== projectId || p.goal?.shape !== "number") return p;
    const current = Math.min(p.goal.targetNumber ?? Infinity, (p.goal.current ?? 0) + amount);
    updated = { ...p, goal: { ...p.goal, current } };
    return updated;
  });
  if (!updated) return undefined;
  commit({
    ...state,
    projects,
    progressHistory: {
      ...state.progressHistory,
      [projectId]: [...(state.progressHistory[projectId] ?? []), amount],
    },
  });
  return updated;
}

/** Undoes the most recently logged tap — not a full history browser, just
 * the one-step "oops" recovery a tap-to-log interaction needs. */
export function undoLastProgress(projectId: string): Project | undefined {
  const history = state.progressHistory[projectId];
  if (!history?.length) return undefined;
  const last = history[history.length - 1];

  let updated: Project | undefined;
  const projects = state.projects.map((p) => {
    if (p.id !== projectId || p.goal?.shape !== "number") return p;
    const current = Math.max(0, (p.goal.current ?? 0) - last);
    updated = { ...p, goal: { ...p.goal, current } };
    return updated;
  });
  if (!updated) return undefined;
  commit({
    ...state,
    projects,
    progressHistory: { ...state.progressHistory, [projectId]: history.slice(0, -1) },
  });
  return updated;
}

/** Plain-language progress for a numeric goal — "3 of 10 pieces," never a
 * percentage, which reads as scorekeeping the brand explicitly avoids. */
export function goalProgressText(goal: Goal): string | undefined {
  if (goal.shape !== "number" || goal.targetNumber == null) return undefined;
  const current = goal.current ?? 0;
  return `${current} of ${goal.targetNumber}${goal.unit ? ` ${goal.unit}` : ""}`;
}

/** A number goal's own secondary deadline, shown alongside its count (a
 * date-shaped goal's deadline is already its whole `label` and doesn't use
 * this). "Sep 23," no year — same short form templateLabel already uses. */
export function goalDeadlineText(goal: Goal): string | undefined {
  if (!goal.targetDate) return undefined;
  return new Date(goal.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Applies a patch to one Pursuit and returns the updated copy, for the
 * caller to mirror to Supabase. Every state change below goes through here. */
function patchProject(projectId: string, patch: (p: Project) => Partial<Project>): Project | undefined {
  let updated: Project | undefined;
  const projects = state.projects.map((p) => {
    if (p.id !== projectId) return p;
    updated = { ...p, ...patch(p) };
    return updated;
  });
  if (!updated) return undefined;
  commit({ ...state, projects });
  return updated;
}

/** Marks a Pursuit complete, optionally with the answer to "What would you
 * tell yourself on day one?" */
export function finishProject(projectId: string, endingNote?: string): Project | undefined {
  return patchProject(projectId, () => ({
    finishedAt: Date.now(),
    pausedAt: undefined,
    ...(endingNote?.trim() ? { endingNote: endingNote.trim() } : {}),
  }));
}

/** Adds or edits the ending note after the fact. */
export function setEndingNote(projectId: string, endingNote: string): Project | undefined {
  return patchProject(projectId, () => ({ endingNote: endingNote.trim() || undefined }));
}

/** "Pausing for now." Rests the Pursuit — no warning, no penalty. */
export function pauseProject(projectId: string): Project | undefined {
  return patchProject(projectId, () => ({
    pausedAt: Date.now(),
    finishedAt: undefined,
    checkInAnsweredAt: Date.now(),
    checkInsIgnored: 0,
  }));
}

/** A Moment landed on this Pursuit by a path that doesn't go through
 * attachEntry (a private log). Same effect: reopens it if it was resting or
 * finished, and counts as answering any open check-in. */
export function markActivity(projectId: string): Project | undefined {
  return patchProject(projectId, () => ({
    pausedAt: undefined,
    finishedAt: undefined,
    checkInAnsweredAt: Date.now(),
    checkInsIgnored: 0,
  }));
}

/** Picks a resting or finished Pursuit back up. */
export function resumeProject(projectId: string): Project | undefined {
  return patchProject(projectId, () => ({
    pausedAt: undefined,
    finishedAt: undefined,
    checkInAnsweredAt: Date.now(),
    checkInsIgnored: 0,
  }));
}

/** The maker's own check-in cadence, in days (0 = never). */
export function setCheckInDays(projectId: string, days: number): Project | undefined {
  return patchProject(projectId, () => ({ checkInDays: days, checkInAnsweredAt: Date.now(), checkInsIgnored: 0 }));
}

/** "Not now" on a check-in. Counts toward the two-strikes rule, after
 * which Sushii stops asking about this Pursuit. */
export function dismissCheckIn(projectId: string): Project | undefined {
  return patchProject(projectId, (p) => ({
    checkInAnsweredAt: Date.now(),
    checkInsIgnored: (p.checkInsIgnored ?? 0) + 1,
  }));
}

/**
 * Whether this Pursuit is due a check-in right now. Only active Pursuits,
 * only on the maker's own cadence, measured from whichever is latest: the
 * last Moment, the last answered check-in, or the start. Stops for good
 * after two unanswered check-ins in a row.
 */
export function checkInDue(p: Project, lastMomentAt: number | undefined, now = Date.now()): boolean {
  if (pursuitStatus(p) !== "active") return false;
  const days = p.checkInDays ?? DEFAULT_CHECK_IN_DAYS;
  if (days <= 0) return false;
  if ((p.checkInsIgnored ?? 0) >= 2) return false;
  const since = Math.max(lastMomentAt ?? 0, p.checkInAnsweredAt ?? 0, p.startedAt);
  return now - since >= days * 86_400_000;
}

/**
 * Adds any Pursuits from the database that aren't already in this browser's
 * local journal — called after sign-in to bring back what a previous
 * sign-out's clearLocalData() wiped from here. Every Pursuit a signed-in
 * maker starts is already mirrored to Supabase via mirrorPursuit
 * (lib/pursuitsRemote.ts) regardless of whether it's shared, so the account
 * has always had a durable copy; the only thing that was missing was
 * anything reading it back. This only ever adds — a Pursuit already present
 * locally is left exactly as it is, since that copy might hold an edit made
 * in this tab that hasn't been mirrored yet.
 */
export function mergeRemoteProjects(remote: Project[]) {
  const knownIds = new Set(state.projects.map((p) => p.id));
  const toAdd = remote.filter((p) => !knownIds.has(p.id));
  // Fields added after a Pursuit was first restored (resting, check-in
  // cadence, ending note) can be missing from a local copy that's otherwise
  // up to date. Fill only what's absent locally — never overwrite, same
  // local-wins rule as the add path above.
  const byId = new Map(remote.map((p) => [p.id, p]));
  let filled = false;
  const existing = state.projects.map((p) => {
    const r = byId.get(p.id);
    if (!r) return p;
    const patch: Partial<Project> = {};
    if (p.pausedAt === undefined && r.pausedAt !== undefined && !p.finishedAt) patch.pausedAt = r.pausedAt;
    if (p.checkInDays === undefined && r.checkInDays !== undefined) patch.checkInDays = r.checkInDays;
    if (p.endingNote === undefined && r.endingNote !== undefined) patch.endingNote = r.endingNote;
    if (p.measure === undefined && r.measure !== undefined) patch.measure = r.measure;
    if (p.mode === undefined && r.mode !== undefined) patch.mode = r.mode;
    if (Object.keys(patch).length === 0) return p;
    filled = true;
    return { ...p, ...patch };
  });
  if (toAdd.length === 0 && !filled) return;
  commit({
    ...state,
    projects: [...existing, ...toAdd].sort((a, b) => b.startedAt - a.startedAt),
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


// ── Measured progress ──────────────────────────────────────────────────

/** Logs an amount toward a Pursuit. Returns the entry (for the caller to
 * mirror to Supabase). */
export function addProgress(entry: Omit<ProgressEntry, "id" | "createdAt"> & { createdAt?: number }): ProgressEntry {
  const full: ProgressEntry = { id: id(), createdAt: Date.now(), ...entry };
  commit({ ...state, progress: [...(state.progress ?? []), full] });
  return full;
}

export function removeProgress(entryId: string) {
  commit({ ...state, progress: (state.progress ?? []).filter((e) => e.id !== entryId) });
}

/** Adds a joined Pursuit (someone else's) to this browser's journal. */
export function addJoinedProject(project: Project) {
  if (state.projects.some((p) => p.id === project.id)) {
    commit({ ...state, projects: state.projects.map((p) => (p.id === project.id ? { ...p, ...project } : p)) });
    return;
  }
  commit({ ...state, projects: [project, ...state.projects] });
}

export function setProjectMembers(projectId: string, members: PursuitMember[]): Project | undefined {
  return patchProject(projectId, () => ({ members }));
}

export function setProjectMode(projectId: string, mode: PursuitMode): Project | undefined {
  return patchProject(projectId, () => ({ mode }));
}

export function setProjectMeasure(projectId: string, measure: Measure): Project | undefined {
  return patchProject(projectId, () => ({ measure }));
}
