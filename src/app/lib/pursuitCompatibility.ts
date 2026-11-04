import type { Goal, Measure, Project, ProgressEntry } from "./journal";
import { toDateInput } from "./pursuitProgress";
import type { Contribution, Workflow, WorkflowData } from "./pursuitWorkflow";

export interface LegacySource {
  kind: "measure" | "goal" | "updates" | "moments";
  measure?: Omit<Measure, "workflow">;
  goal?: Goal;
}
/** Read-time presentation adapter. Never writes to storage or changes historical records. */
export function compatibleProject(p: Project): Project {
  if (p.plan) return p;
  const existing = p.measure?.workflow;
  if (existing && !existing.legacy) return p;
  const source: LegacySource =
    existing?.legacy ??
    (p.measure
      ? { kind: "measure", measure: p.measure }
      : p.goal?.shape === "number"
        ? { kind: "goal", goal: p.goal }
        : p.targetMoments != null
          ? { kind: "moments", goal: p.goal }
          : { kind: "updates", goal: p.goal });
  const raw = source.measure;
  const date = raw?.targetDate ?? p.goal?.targetDate;
  const workflow: Workflow = existing ?? {
    version: 2,
    legacy: source,
    tracking: source.kind === "updates" ? "updates" : "total",
    target:
      raw && raw.target > 0
        ? raw.target
        : (p.goal?.targetNumber ?? p.targetMoments ?? undefined),
    unit:
      raw?.unit ?? p.goal?.unit ?? (source.kind === "moments" ? "Moments" : ""),
    items: [],
    finishBy: date ? toDateInput(date) : undefined,
  };
  // Numeric goal.current and startingAmount are baselines, not fabricated dated sessions.
  const startingAmount =
    source.kind === "goal"
      ? (p.goal?.current ?? source.goal?.current ?? 0)
      : source.kind === "measure"
        ? (raw?.startingAmount ?? 0)
        : 0;
  return {
    ...p,
    mode: p.mode ?? "solo",
    measure: {
      ...(p.measure ?? {
        kind: "quantity",
        target: workflow.target ?? 0,
        unit: workflow.unit,
        allowPartial: true,
        allowDecimals: true,
        defaultAmount: 1,
        startingAmount: 0,
      }),
      workflow: {
        ...workflow,
        startingAmount,
        startingUserId: p.ownerId ?? "local",
      },
    },
  };
}
export function legacyContribution(
  e: ProgressEntry,
  uid: string,
): Contribution {
  return {
    id: `legacy:${e.id}`,
    legacy_id: e.id,
    image_url: e.image,
    pursuit_id: e.projectId,
    user_id: e.userId ?? uid,
    amount: e.amount,
    occurred_at: new Date(e.createdAt).toISOString(),
    created_at: new Date(e.createdAt).toISOString(),
    note: e.note ?? "",
    post_id: typeof e.postId === "number" ? e.postId : null,
  };
}
export function mergeLegacyContributions(
  data: WorkflowData,
  entries: ProgressEntry[],
  uid: string,
): WorkflowData {
  const byId = new Map(data.contributions.map((e) => [e.id, e]));
  for (const e of entries) {
    const row = legacyContribution(e, uid);
    byId.set(row.id, row);
  }
  return {
    ...data,
    contributions: [...byId.values()].sort((a, b) =>
      a.occurred_at.localeCompare(b.occurred_at),
    ),
  };
}
export function legacyLabel(p: Project): string | undefined {
  const source = p.measure?.workflow?.legacy;
  return source?.measure?.whatCounts || p.goal?.label || undefined;
}

import { supabase } from "../../lib/supabase";
import { getJournal, removeProgress } from "./journal";
import { emptyWorkflowData } from "./pursuitWorkflow";
export async function readLegacyData(
  project: Project,
  uid: string,
  signedIn: boolean,
): Promise<WorkflowData> {
  const data = emptyWorkflowData();
  if (!signedIn)
    return mergeLegacyContributions(
      data,
      getJournal().progress.filter((e) => e.projectId === project.id),
      uid,
    );
  if (!supabase) throw new Error("Couldn’t connect. Try again.");
  const [progress, sessions] = await Promise.all([
    supabase.from("pursuit_progress").select("*").eq("pursuit_id", project.id),
    supabase.from("pursuit_sessions").select("*").eq("pursuit_id", project.id),
  ]);
  if (progress.error || sessions.error)
    throw new Error("Progress couldn’t be loaded. Try again.");
  let entries: ProgressEntry[] = (progress.data ?? []).map((e) => ({
    id: e.id,
    projectId: e.pursuit_id,
    userId: e.user_id,
    amount: Number(e.amount),
    createdAt: Date.parse(e.created_at),
    note: e.note ?? undefined,
    postId: e.post_id ?? undefined,
    image: e.image_url ?? undefined,
  }));
  const momentRows: Contribution[] = [];
  if (project.measure?.workflow?.legacy?.kind === "moments") {
    const result = await supabase
      .from("posts")
      .select("id,user_id,pursuit_id,created_at")
      .eq("pursuit_id", project.id);
    if (result.error) throw new Error("Moments couldn’t be loaded. Try again.");
    entries = [];
    momentRows.push(
      ...(result.data ?? []).map((e) => ({
        id: `moment:${e.id}`,
        pursuit_id: e.pursuit_id,
        user_id: e.user_id,
        amount: 1,
        created_at: e.created_at,
        occurred_at: e.created_at,
        note: "",
        post_id: e.id,
      })),
    );
  }
  const merged = mergeLegacyContributions(data, entries, uid);
  merged.contributions.push(...momentRows);
  merged.sessions = (sessions.data ?? []).map((s) => ({
    id: `legacy-session:${s.id}`,
    legacy_id: s.id,
    pursuit_id: s.pursuit_id,
    user_id: s.created_by,
    title: project.title,
    starts_at: s.starts_at,
    place: s.place ?? "",
    note: s.note ?? "",
    series_id: `legacy-session:${s.id}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cancelled: false,
  }));
  if (sessions.data?.length) {
    const ids=sessions.data.map(s=>s.id);
    const [attendance,declines]=await Promise.all([
      supabase.from('pursuit_session_rsvps').select('*').in('session_id',ids),
      supabase.from('pursuit_session_declines').select('session_id,user_id').in('session_id',ids),
    ]);
    if(attendance.error || declines.error) throw new Error('Sessions couldn’t be loaded. Try again.');
    merged.attendance = (attendance.data ?? []).map((a) => ({
      session_id: `legacy-session:${a.session_id}`,
      user_id: a.user_id,
      going: true,
    }));
    merged.attendance.push(...(declines.data??[]).map(a=>({session_id:`legacy-session:${a.session_id}`,user_id:a.user_id,going:false})));
  }
  return merged;
}
export function mergeLegacyData(
  current: WorkflowData,
  legacy: WorkflowData,
): WorkflowData {
  return {
    ...current,
    contributions: [...current.contributions, ...legacy.contributions],
    sessions: [...current.sessions, ...legacy.sessions],
    attendance: [...current.attendance, ...legacy.attendance],
  };
}
export async function changeLegacyProgress(
  project: Project,
  row: Contribution | undefined,
  removeId: string | undefined,
  signedIn: boolean,
) {
  const id = removeId?.replace(/^legacy:/, "") ?? row?.legacy_id;
  if (!id) throw new Error("Progress couldn’t be found. Try again.");
  if (signedIn) {
    if (!supabase) throw new Error("Couldn’t connect. Try again.");
    const { error } = await supabase.rpc("edit_legacy_pursuit_progress", {
      p_pursuit: project.id,
      p_entry: id,
      p_amount: row?.amount ?? null,
      p_note: row?.note ?? null,
      p_remove: !!removeId,
    });
    if (error) throw new Error("Changes couldn’t be saved. Try again.");
  }
  if (removeId) removeProgress(id);
  else if (row) {
    // Local updates preserve id, links, media, author and original timestamp.
    const original = getJournal().progress.find((e) => e.id === id);
    if (original) {
      const { updateLegacyProgress } = await import("./journal");
      updateLegacyProgress(id, row.amount, row.note);
    }
  }
}
