import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { DEFAULT_CHECK_IN_DAYS, dropProject, startProject, type PursuitMember } from "./journal";
import { mirrorPursuitOpen, setImIn } from "./openPursuits";
import { endsAtFor } from "./pursuitGoal";
import { defaultMeasure } from "./pursuitProgress";
import { mirrorPursuit, mirrorPursuitMeasure, saveInvites } from "./pursuitsRemote";
import { cancelRsvp } from "./spaces";
import { ERROR_LINE } from "./stateCopy";
import type { Owner } from "./firstPlanRemote";

/**
 * The changes a person makes to a plan from the calendar. A plan someone makes
 * is a small Pursuit of their own with one session (the same thing the first
 * plan makes), so cancelling it deletes that session, moving it changes the
 * session's time, and leaving someone else's plan takes only you out. Every
 * call says what went wrong in one line, or returns null when it worked.
 */

export interface NewPlan {
  title: string;
  /** "space-slug/corner-slug". */
  cornerKey: string;
  startsAt: number;
  /** A connection to invite. */
  friendId?: string;
}

/** A plan made from the calendar: a small Pursuit, a session at the chosen time, and an invite to the friend if one was picked. */
export async function createPlan(plan: NewPlan, owner: Owner, now = Date.now()): Promise<{ sessionId?: number; pursuitId?: string; error?: string }> {
  if (!supabase) return { error: ERROR_LINE };
  const [spaceSlug = "", slug = ""] = plan.cornerKey.split("/");
  try {
    const endsAt = endsAtFor(Math.max(1, Math.ceil((plan.startsAt - now) / 86_400_000)), new Date(now));
    const member: PursuitMember = { userId: owner.id, username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl, status: "joined", role: "owner" };
    const project = startProject({
      title: plan.title.slice(0, 80),
      hobbySlug: spaceSlug,
      subHobby: slug,
      measure: { ...defaultMeasure("count"), target: 1, unit: "times", targetDate: endsAt },
      mode: "together",
      members: [member],
      checkInDays: DEFAULT_CHECK_IN_DAYS,
      shared: false,
    });
    await mirrorPursuit(owner.id, project);
    await mirrorPursuitMeasure(project.id, "together", project.measure);
    await mirrorPursuitOpen(project.id, { visibility: "friends", endsAt });
    const { data, error } = await supabase
      .from("pursuit_sessions")
      .insert({ pursuit_id: project.id, starts_at: new Date(plan.startsAt).toISOString(), place: null, note: plan.title.slice(0, 140), created_by: owner.id })
      .select("id")
      .single();
    if (error || !data) return { error: error ? friendlyError(error) : ERROR_LINE };
    if (plan.friendId) {
      const invited = await saveInvites(project.id, owner.id, [plan.friendId]);
      if (invited) return { sessionId: (data as { id: number }).id, pursuitId: project.id, error: invited };
    }
    return { sessionId: (data as { id: number }).id, pursuitId: project.id };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}

/** The number in "session-7" or "event-12", or null. */
export function planNumber(id: string, kind: "session" | "event"): number | null {
  const m = new RegExp(`^${kind}-(\\d+)$`).exec(id);
  return m ? Number(m[1]) : null;
}

/** Cancels a plan the person made: the session goes. */
export async function deleteSession(sessionId: number): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = await supabase.from("pursuit_sessions").delete().eq("id", sessionId);
    return error ? friendlyError(error) : null;
  } catch (e) {
    return friendlyError(e);
  }
}

/**
 * Cancels a one-off plan the person made. The plan is a Pursuit with one session,
 * so once the session is gone the Pursuit goes too, but only when it is plainly
 * nothing else: no other session, nobody else in it, no progress logged and no
 * Stub issued. Anything less and the Pursuit stays as it was; only the session goes.
 */
export async function cancelOwnPlan(sessionId: number, pursuitId: string | undefined): Promise<string | null> {
  const error = await deleteSession(sessionId);
  if (error || !pursuitId || !supabase) return error;
  try {
    if (!(await isEmptyShell(pursuitId))) return null;
    const { error: gone } = await supabase.from("pursuits").delete().eq("id", pursuitId);
    // The plan itself is cancelled either way; a Pursuit that could not be removed just stays.
    if (!gone) dropProject(pursuitId);
  } catch {
    // Same: the plan is cancelled.
  }
  return null;
}

/** True when nothing but the owner and an empty plan is left in the Pursuit. Any doubt (a failed read) counts as not empty. */
async function isEmptyShell(pursuitId: string): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  const empty = async (table: string, narrow: (q: any) => any = (q) => q) => {
    const { count, error } = await narrow(client.from(table).select("pursuit_id", { count: "exact", head: true }).eq("pursuit_id", pursuitId));
    return !error && count === 0;
  };
  const checks = await Promise.all([
    empty("pursuit_sessions"),
    // Anyone besides the owner who is in, invited or asking to join.
    empty("pursuit_members", (q) => q.neq("role", "owner").neq("status", "declined")),
    empty("pursuit_progress"),
    empty("stubs"),
    empty("posts"),
  ]);
  return checks.every(Boolean);
}

/** Moves a session the person owns. */
export async function moveSession(sessionId: number, startsAt: number): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = await supabase.from("pursuit_sessions").update({ starts_at: new Date(startsAt).toISOString() }).eq("id", sessionId);
    return error ? friendlyError(error) : null;
  } catch (e) {
    return friendlyError(e);
  }
}

/** Takes the person out of a session or an event; the plan itself stays for the others. */
export async function leavePlan(plan: { id: string; kind: "event" | "session" }, userId: string): Promise<string | null> {
  if (plan.kind === "event") {
    const id = planNumber(plan.id, "event");
    if (id === null) return ERROR_LINE;
    const r = await cancelRsvp(id);
    return r.error;
  }
  const id = planNumber(plan.id, "session");
  return id === null ? ERROR_LINE : setImIn(id, userId, false);
}

export interface Connection {
  id: string;
  name: string;
}

/** People the viewer is connected to: an accepted follow both ways, the same rule as the Week view's names. Best effort. */
export async function fetchConnections(userId: string): Promise<Connection[]> {
  if (!supabase) return [];
  try {
    const [mine, theirs] = await Promise.all([
      supabase.from("profile_follows").select("followed_id").eq("follower_id", userId).eq("status", "accepted"),
      supabase.from("profile_follows").select("follower_id").eq("followed_id", userId).eq("status", "accepted"),
    ]);
    const iFollow = new Set(((mine.data ?? []) as { followed_id: string }[]).map((r) => r.followed_id));
    const ids = ((theirs.data ?? []) as { follower_id: string }[]).map((r) => r.follower_id).filter((id) => iFollow.has(id));
    if (ids.length === 0) return [];
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids.slice(0, 100));
    return ((data ?? []) as { id: string; display_name: string | null }[])
      .map((p) => ({ id: p.id, name: p.display_name?.trim().slice(0, 60) || "Someone" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
