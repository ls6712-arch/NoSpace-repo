import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { LOCAL_CLEARED_EVENT } from "./localData";
import { addJoinedProject, getJournal, type Project } from "./journal";
import { fetchPursuitAsProject } from "./pursuitsRemote";
import { defaultMeasure } from "./pursuitProgress";
import {
  emptyWorkflowData,
  type Workflow,
  type WorkflowData,
} from "./pursuitWorkflow";

const KEY = "sushii.pursuitWorkflow.v2";
const tableNames = {
  contributions: "pursuit_contributions",
  goals: "pursuit_personal_goals",
  messages: "pursuit_discussion",
  sessions: "pursuit_meetings",
  attendance: "pursuit_attendance",
  applause: "pursuit_applause",
  notices: "pursuit_notices",
} as const;
export type Collection = keyof typeof tableNames;
function readLocal(): Record<string, WorkflowData> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
let local = typeof window === "undefined" ? {} : readLocal();
const listeners = new Set<() => void>();
if (typeof window !== "undefined")
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    local = {};
    listeners.forEach((f) => f());
  });
export function localWorkflow(id: string) {
  return local[id] ?? emptyWorkflowData();
}
export function storeLocalWorkflow(id: string, data: WorkflowData) {
  // Throw rather than reporting a persisted save when storage is full.
  const next = { ...local, [id]: data };
  localStorage.setItem(KEY, JSON.stringify(next));
  local = next;
  listeners.forEach((f) => f());
}
export const newWorkflowId = (): string => crypto.randomUUID();
export function measureFor(w: Workflow) {
  return {
    ...defaultMeasure(
      w.tracking === "total"
        ? "quantity"
        : w.tracking === "checklist"
          ? "milestones"
          : "count",
    ),
    target:
      w.tracking === "checklist"
        ? w.items.filter((i) => !i.archived).length
        : (w.target ?? 0),
    unit: w.unit,
    defaultAmount: 1,
    allowDecimals: w.tracking === "total",
    milestones: w.items.filter((i) => !i.archived).map((i) => i.title),
    workflow: w,
  };
}
export async function createWorkflow(
  project: Project,
  invitees: string[],
  signedIn: boolean,
) {
  if (signedIn) {
    if (!supabase) throw new Error("Couldn’t connect. Try again.");
    const { error } = await supabase.rpc("create_pursuit_workflow", {
      p_project: project,
      p_invitees: invitees,
    });
    if (error) throw new Error("The Pursuit couldn’t be saved. Try again.");
    const saved = await fetchPursuitAsProject(project.id);
    if (!saved) throw new Error("The Pursuit couldn’t be loaded. Try again.");
    project = { ...saved, role: "owner" };
  }
  if (!signedIn) {
    const state = getJournal();
    const projects = state.projects.some((p) => p.id === project.id)
      ? state.projects.map((p) =>
          p.id === project.id ? { ...p, ...project } : p,
        )
      : [project, ...state.projects];
    localStorage.setItem(
      "sushii.journal.v1",
      JSON.stringify({ ...state, projects }),
    );
  }
  addJoinedProject(project);
}
export async function saveWorkflowProject(project: Project, signedIn: boolean) {
  if (signedIn) {
    if (!supabase) throw new Error("Couldn’t connect. Try again.");
    const { error } = await supabase.rpc("edit_pursuit_workflow", {
      p_id: project.id,
      p_title: project.title,
      p_measure: project.measure,
      p_finished: project.finishedAt
        ? new Date(project.finishedAt).toISOString()
        : null,
      p_paused: project.pausedAt
        ? new Date(project.pausedAt).toISOString()
        : null,
    });
    if (error)
      throw new Error("Changes couldn’t be saved. Refresh and try again.");
  }
  if (!signedIn) {
    const state = getJournal();
    const projects = state.projects.some((p) => p.id === project.id)
      ? state.projects.map((p) =>
          p.id === project.id ? { ...p, ...project } : p,
        )
      : [project, ...state.projects];
    localStorage.setItem(
      "sushii.journal.v1",
      JSON.stringify({ ...state, projects }),
    );
  }
  addJoinedProject(project);
}
export async function fetchWorkflow(id: string): Promise<WorkflowData> {
  if (!supabase) throw new Error("Couldn’t connect. Try again.");
  const client = supabase;
  const data = emptyWorkflowData();
  await Promise.all(
    (Object.keys(tableNames) as Collection[]).map(async (key) => {
      const { data: rows, error } = await client
        .from(tableNames[key])
        .select("*")
        .eq("pursuit_id", id);
      if (error) throw new Error("Progress couldn’t be loaded. Try again.");
      // All lists are scoped by RLS and Pursuit id, including attendance and applause.
      (data[key] as unknown[]) = rows ?? [];
    }),
  );
  return data;
}
export function useWorkflowData(id: string, signedIn: boolean) {
  const [data, setData] = useState<WorkflowData>(() =>
    signedIn ? emptyWorkflowData() : localWorkflow(id),
  );
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!signedIn) {
        setData(localWorkflow(id));
        setLoading(false);
        return;
      }
      try {
        const result = await fetchWorkflow(id);
        if (live) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const localChange = () => {
      if (!signedIn && live) setData(localWorkflow(id));
    };
    listeners.add(localChange);
    // Poll only while visible, also refreshing on return to this tab.
    const poll = () => {
      if (!document.hidden) void load();
    };
    const timer = signedIn ? window.setInterval(poll, 15000) : undefined;
    window.addEventListener("focus", poll);
    return () => {
      live = false;
      listeners.delete(localChange);
      clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [id, signedIn, refresh]);
  async function put<K extends Collection>(
    key: K,
    rows: WorkflowData[K],
    removeId?: string,
  ) {
    if (signedIn) {
      if (!supabase) throw new Error("Couldn’t connect. Try again.");
      if (removeId) {
        const { data: removed, error } = await supabase
          .from(tableNames[key])
          .delete()
          .eq("pursuit_id", id)
          .eq("id", removeId)
          .select("id");
        if (!removed?.length || error)
          throw new Error("Changes couldn’t be saved. Try again.");
      } else if (key === "notices") {
        for (const row of rows as WorkflowData["notices"]) {
          const { error } = await supabase
            .from(tableNames.notices)
            .update({ read_at: row.read_at })
            .eq("id", row.id);
          if (error) throw new Error("Changes couldn’t be saved. Try again.");
        }
      } else if (key === "sessions") {
        const { error } = await supabase.rpc("save_pursuit_meetings", {
          p_rows: rows,
        });
        if (error)
          throw new Error(
            "The session couldn’t be saved. Refresh and try again.",
          );
      } else {
        const conflict =
          key === "goals"
            ? "pursuit_id,user_id"
            : key === "attendance"
              ? "session_id,user_id"
              : key === "applause"
                ? "message_id,user_id"
                : "id";
        const { error } = await supabase
          .from(tableNames[key])
          .upsert(rows as unknown as Record<string, unknown>[], {
            onConflict: conflict,
            ignoreDuplicates: key === "messages" || key === "applause",
          });
        if (error)
          throw new Error("Changes couldn’t be saved. Refresh and try again.");
      }
      const next = await fetchWorkflow(id);
      setData(next);
      if (key === "notices") window.dispatchEvent(new Event("pursuit-notices-changed"));
    } else {
      const current = { ...localWorkflow(id) };
      const nextRows = [
        ...(current[key] as {
          id?: string;
          user_id?: string;
          session_id?: string;
        }[]),
      ];
      if (removeId) {
        (current[key] as unknown[]) = nextRows.filter((r) => r.id !== removeId);
      } else {
        for (const row of rows as {
          id?: string;
          user_id?: string;
          session_id?: string;
        }[]) {
          const index = nextRows.findIndex((r) =>
            row.id
              ? r.id === row.id
              : key === "attendance"
                ? r.session_id === row.session_id && r.user_id === row.user_id
                : r.user_id === row.user_id,
          );
          if (index >= 0) nextRows[index] = row;
          else nextRows.push(row);
        }
        (current[key] as unknown[]) = nextRows;
      }
      storeLocalWorkflow(id, { ...current });
      setData({ ...current });
    }
  }
  return { data, loading, error, retry: () => setRefresh((n) => n + 1), put };
}

/** One stable contribution per Moment. Recording a private Moment never copies its note into a group. */
export async function recordWorkflowMoment(
  project: Project,
  amount: number,
  userId: string | undefined,
  postId?: number,
  logId?: number,
  note = "",
) {
  const w = project.measure?.workflow;
  if (!w || !["sessions", "total"].includes(w.tracking)) return null;
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `pursuit-moment:${project.id}:${postId != null ? `post:${postId}` : `private:${logId}`}`,
      ),
    ),
  );
  const hex = [...bytes.slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  const now = new Date().toISOString();
  const row = {
    id,
    pursuit_id: project.id,
    user_id: userId ?? "local",
    amount: w.tracking === "sessions" ? 1 : amount,
    occurred_at: now,
    created_at: now,
    note: postId != null && (project.mode ?? "solo") === "solo" ? note.slice(0, 1000) : "",
    post_id: postId ?? null,
  };
  if (userId) {
    if (!supabase) throw new Error("Couldn’t connect. Try again.");
    const { error } = await supabase
      .from("pursuit_contributions")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Progress couldn’t be saved.");
  } else {
    const data = localWorkflow(project.id);
    if (!data.contributions.some((e) => e.id === id))
      storeLocalWorkflow(project.id, {
        ...data,
        contributions: [...data.contributions, row],
      });
  }
  return row;
}
export async function removeWorkflowMoment(
  projectId: string,
  entryId: string,
  signedIn: boolean,
) {
  if (signedIn) {
    if (!supabase) throw new Error("Couldn’t connect. Try again.");
    const { error } = await supabase
      .from("pursuit_contributions")
      .delete()
      .eq("id", entryId)
      .eq("pursuit_id", projectId);
    if (error) throw new Error("Progress couldn’t be removed. Try again.");
  } else {
    const data = localWorkflow(projectId);
    storeLocalWorkflow(projectId, {
      ...data,
      contributions: data.contributions.filter((e) => e.id !== entryId),
    });
  }
}
