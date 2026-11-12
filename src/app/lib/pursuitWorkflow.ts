import type { Project } from "./journal";

export type Tracking = "sessions" | "total" | "checklist" | "updates";
export interface ChecklistItem {
  id: string;
  title: string;
  archived?: boolean;
}
export interface Workflow {
  version: 2;
  legacy?: import("./pursuitCompatibility").LegacySource;
  startingAmount?: number;
  startingUserId?: string;
  tracking: Tracking;
  target?: number;
  unit: string;
  finishBy?: string;
  items: ChecklistItem[];
}
export interface Contribution {
  legacy_id?: string;
  image_url?: string;
  id: string;
  pursuit_id: string;
  user_id: string;
  amount: number;
  occurred_at: string;
  created_at: string;
  note: string;
  post_id?: number | null;
  item_id?: string | null;
  session_id?: string | null;
}
export interface PersonalGoal {
  pursuit_id: string;
  user_id: string;
  target: number | null;
  finish_by: string | null;
  status: "active" | "paused" | "finished";
  muted: boolean;
  reminder_minutes?: number | null;
}
export interface Discussion {
  id: string;
  pursuit_id: string;
  user_id: string;
  body: string;
  thread: string;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
}
export interface Meeting {
  legacy_id?: number;
  id: string;
  pursuit_id: string;
  user_id: string;
  title: string;
  starts_at: string;
  place: string;
  note: string;
  series_id: string;
  timezone: string;
  cancelled: boolean;
}
export interface Attendance {
  session_id: string;
  user_id: string;
  going: boolean;
}
export interface Applause {
  message_id: string;
  user_id: string;
}
export interface Notice {
  id: string;
  pursuit_id: string;
  user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
export interface WorkflowData {
  contributions: Contribution[];
  goals: PersonalGoal[];
  messages: Discussion[];
  sessions: Meeting[];
  attendance: Attendance[];
  applause: Applause[];
  notices: Notice[];
}
export const emptyWorkflowData = (): WorkflowData => ({
  contributions: [],
  goals: [],
  messages: [],
  sessions: [],
  attendance: [],
  applause: [],
  notices: [],
});
export const trackingOptions: {
  value: Tracking;
  label: string;
  description: string;
}[] = [
  {
    value: "sessions",
    label: "Sessions",
    description: "Count each time you do it.",
  },
  {
    value: "total",
    label: "Total",
    description: "Add up pages, hours, distance, or another amount.",
  },
  {
    value: "checklist",
    label: "Checklist",
    description: "Check things off as you go.",
  },
  {
    value: "updates",
    label: "Moments only",
    description: "Share how it’s going without counting progress.",
  },
];
export const workflowOf = (p: Project): Workflow | undefined =>
  p.measure?.workflow;
export function validateWorkflow(w: Workflow): string | null {
  if (!trackingOptions.some((o) => o.value === w.tracking))
    return "Choose how to track this.";
  if (
    w.target != null &&
    (!Number.isFinite(w.target) ||
      w.target <= 0 ||
      w.target > 100000000 ||
      (w.tracking === "sessions" && !Number.isInteger(w.target)))
  )
    return "Enter a valid target.";
  if (w.tracking === "total" && !w.unit.trim() && !w.legacy)
    return "Enter a unit.";
  if (
    w.tracking === "checklist" &&
    !w.items.some((i) => !i.archived && i.title.trim())
  )
    return "Add a checklist item.";
  if (
    new Set(w.items.map((i) => i.id)).size !== w.items.length ||
    w.items.some((i) => !i.id || !i.title.trim())
  )
    return "Check your checklist items.";
  if (
    w.finishBy &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(w.finishBy) ||
      !Number.isFinite(Date.parse(w.finishBy)) ||
      new Date(w.finishBy).toISOString().slice(0, 10) !== w.finishBy)
  )
    return "Choose a valid date.";
  return null;
}
export function progressFor(
  w: Workflow,
  entries: Contribution[],
  userId?: string,
  target: number | null | undefined = w.target,
) {
  const relevant = userId
    ? entries.filter((e) => e.user_id === userId)
    : entries;
  const items = w.items.filter((i) => !i.archived);
  const logged =
    w.tracking === "checklist"
      ? new Set(
          relevant
            .filter((e) => items.some((i) => i.id === e.item_id))
            .map((e) => e.item_id),
        ).size
      : w.tracking === "sessions"
        ? relevant.reduce((n, e) => n + e.amount, 0)
        : w.tracking === "total"
          ? relevant.reduce((n, e) => n + e.amount, 0)
          : relevant.length;
  const current =
    logged +
    (w.tracking === "updates" ||
    (userId && w.startingUserId && userId !== w.startingUserId)
      ? 0
      : (w.startingAmount ?? 0));
  const total =
    w.tracking === "checklist"
      ? items.length
      : w.tracking === "updates"
        ? undefined
        : (target ?? undefined);
  return {
    current,
    target: total,
    fraction: total ? Math.min(1, current / total) : 0,
    reached: total != null && total > 0 && current >= total,
  };
}
export function canChangeTracking(
  before: Workflow,
  after: Workflow,
  entries: Contribution[],
) {
  return (
    !entries.length ||
    (before.tracking === after.tracking && before.unit === after.unit)
  );
}
/** Weekly wall-clock recurrence in the creator's zone. JS calendar arithmetic preserves local DST. */
export function weeklyOccurrences(start: string, endDate?: string): string[] {
  const d = new Date(start);
  if (!Number.isFinite(d.getTime()))
    throw new Error("Choose a valid session time.");
  const out = [d.toISOString()];
  if (!endDate) return out;
  const end = new Date(`${endDate}T23:59:59`);
  if (!Number.isFinite(end.getTime()) || end < d)
    throw new Error("Choose a repeat end date after the session.");
  while (out.length < 53) {
    const base = new Date(start);
    d.setTime(
      new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + out.length * 7,
        base.getHours(),
        base.getMinutes(),
        base.getSeconds(),
        base.getMilliseconds(),
      ).getTime(),
    );
    if (d > end) return out;
    out.push(d.toISOString());
  }
  if (d < end) throw new Error("Choose a repeat end date within a year.");
  return out;
}
export function validateContribution(w: Workflow, e: Contribution) {
  if (
    !e.id ||
    !Number.isFinite(e.amount) ||
    (e.legacy_id ? e.amount < 0 : e.amount <= 0) ||
    e.amount > 100000000
  )
    throw new Error("Enter a valid amount.");
  if (!Number.isFinite(Date.parse(e.occurred_at)))
    throw new Error("Choose a valid date.");
  if (
    w.legacy?.measure &&
    !w.legacy.measure.allowDecimals &&
    !Number.isInteger(e.amount)
  )
    throw new Error("Enter a whole amount.");
  if (e.note.length > 1000) throw new Error("Shorten your note.");
  if (w.tracking === "sessions" && e.amount !== 1)
    throw new Error("Log one session at a time.");
  if (
    w.tracking === "checklist" &&
    !w.items.some((i) => i.id === e.item_id && !i.archived)
  )
    throw new Error("Choose a checklist item.");
}

/** Move future occurrences by calendar days and wall time in the series timezone, not a fixed UTC delta. */
export function shiftOccurrence(
  instant: string,
  oldStart: string,
  newStart: string,
  timezone: string,
): string {
  const wall = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));
    const n = (key: string) => Number(parts.find((p) => p.type === key)?.value);
    return {
      day: Date.UTC(n("year"), n("month") - 1, n("day")),
      time: n("hour") * 3600000 + n("minute") * 60000 + n("second") * 1000,
    };
  };
  const old = wall(oldStart),
    next = wall(newStart),
    current = wall(instant);
  const wanted = current.day + next.day - old.day + next.time;
  let guess = wanted;
  for (let i = 0; i < 4; i++) {
    const at = wall(new Date(guess).toISOString());
    const difference = at.day + at.time - wanted;
    if (!difference) return new Date(guess).toISOString();
    guess -= difference;
  }
  throw new Error("Choose a session time that exists in this timezone.");
}
