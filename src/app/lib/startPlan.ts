import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { startSmallPursuit, type Owner } from "./firstPlanRemote";
import type { Plan } from "./firstPlan";
import { cancelOwnPlan, moveSession } from "./planEdits";
import { ERROR_LINE } from "./stateCopy";

/**
 * A plan made from the Start page: the same one-session Pursuit the calendar
 * makes (startSmallPursuit with asPlan), so it shows on the Calendar and Undo
 * can take it back out the same way a cancelled plan goes.
 */

export interface StartPlanRef {
  pursuitId: string;
  sessionId: number;
  startsAt: number;
  title: string;
}

export interface StartPlanInput {
  title: string;
  corner: { key: string; name: string; spaceSlug: string; slug: string };
  startsAt: number;
  /** The guide's first step, kept on the session as its note. */
  step?: string;
}

async function sessionOf(pursuitId: string): Promise<{ id: number; startsAt: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pursuit_sessions").select("id, starts_at").eq("pursuit_id", pursuitId).order("id", { ascending: true }).limit(1);
  const row = (data as { id: number; starts_at: string }[] | null)?.[0];
  return error || !row ? null : { id: row.id, startsAt: Date.parse(row.starts_at) };
}

/** Makes the plan. Exactly one Pursuit and one session, or an error and nothing left behind. */
export async function makeStartPlan(input: StartPlanInput, owner: Owner): Promise<{ plan?: StartPlanRef; error?: string }> {
  const plan: Plan = {
    id: `at_home:${input.corner.key}`,
    kind: "at-home",
    title: input.title.slice(0, 80),
    corner: input.corner,
    startsAt: input.startsAt,
    when: null,
    reason: "",
    step: input.step,
  };
  const made = await startSmallPursuit(plan, owner, Date.now(), { asPlan: true });
  if (!made.pursuitId) return { error: made.error ?? ERROR_LINE };
  try {
    const session = await sessionOf(made.pursuitId);
    if (!session) {
      // The Pursuit exists but its time did not save: take it back rather than leave a plan with no day.
      await cancelOwnPlan(-1, made.pursuitId).catch(() => null);
      return { error: ERROR_LINE };
    }
    return { plan: { pursuitId: made.pursuitId, sessionId: session.id, startsAt: session.startsAt, title: plan.title } };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}

/** Undo and Cancel plan: the session goes, and the Pursuit with it when it is only that plan. */
export async function cancelStartPlan(plan: Pick<StartPlanRef, "pursuitId" | "sessionId">): Promise<string | null> {
  return cancelOwnPlan(plan.sessionId, plan.pursuitId);
}

export const moveStartPlan = (plan: Pick<StartPlanRef, "sessionId">, startsAt: number): Promise<string | null> => moveSession(plan.sessionId, startsAt);

/** The person's own plan for ?plan={pursuitId}, or null when it is not theirs, is gone, or has no time. */
export async function loadStartPlan(pursuitId: string, userId: string): Promise<StartPlanRef | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("pursuits").select("id, title, user_id").eq("id", pursuitId).maybeSingle();
    const row = data as { id: string; title: string; user_id: string } | null;
    if (error || !row || row.user_id !== userId) return null;
    const session = await sessionOf(pursuitId);
    return session ? { pursuitId, sessionId: session.id, startsAt: session.startsAt, title: row.title } : null;
  } catch {
    return null;
  }
}
