import { supabase } from "../../lib/supabase";
import { Goal, GoalShape, Project, attachEntry, mergeRemoteProjects } from "./journal";
import type { Measure, PursuitMember, PursuitMode, ProgressEntry } from "./journal";

/** Shared by every reader of a `pursuits` row — fetchPursuitById,
 * restoreOwnPursuits — so the goal-column mapping only lives in one place. */
function rowToGoal(row: any): Goal | undefined {
  if (!row.goal_shape) return undefined;
  return {
    id: "",
    shape: row.goal_shape as GoalShape,
    label: row.goal_label ?? "",
    targetNumber: row.goal_target_number ?? undefined,
    unit: row.goal_unit ?? undefined,
    current: row.goal_current ?? undefined,
    verb: row.goal_verb ?? undefined,
    targetDate: row.goal_target_date ? new Date(row.goal_target_date).getTime() : undefined,
    createdAt: 0,
    reachedAt: row.goal_reached_at ? new Date(row.goal_reached_at).getTime() : undefined,
  };
}

/** A `pursuits` row as the local journal's own `Project` shape, for merging
 * back into it — see restoreOwnPursuits. */
function rowToProject(row: any): Project {
  return {
    id: row.id,
    title: row.title,
    hobbySlug: row.hobby_slug ?? undefined,
    subHobby: row.sub_hobby ?? undefined,
    interest: row.interest ?? undefined,
    customSpace: row.custom_space ?? undefined,
    inspiredByPostId: row.inspired_by_post_id ?? undefined,
    shared: !!row.shared,
    startedAt: new Date(row.started_at).getTime(),
    finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : undefined,
    goal: rowToGoal(row),
    // Columns from supabase/migrations/20260923100000_pursuit_rest_and_checkins.sql.
    // Absent (undefined) on a database that hasn't run it yet, which reads
    // exactly like a Pursuit that never set them.
    pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : undefined,
    checkInDays: row.check_in_days ?? undefined,
    endingNote: row.ending_note ?? undefined,
    measure: row.measure ?? undefined,
    mode: row.mode ?? undefined,
  };
}

/**
 * The local journal (lib/journal.ts) is the source of truth for the owner's
 * own view of their Pursuits — it works instantly, with or without an
 * account. This file is the one place that talks to the `pursuits` table
 * (sql/pursuits.sql), used only for the one thing local storage can't do:
 * let a Pursuit marked shared show up on the owner's public profile, in
 * someone else's browser.
 *
 * Every function here is best-effort. A signed-out visitor, an unconfigured
 * Supabase project, or a table that hasn't been migrated yet all degrade to
 * "no shared Pursuits to show" rather than an error — the owner's own view
 * never depends on any of this succeeding.
 */

/** Best-effort mirror of one Pursuit into Supabase, so it can be shared. Not
 * awaited by callers that don't need to know whether it landed. */
export async function mirrorPursuit(userId: string, project: Project) {
  if (!supabase) return;
  try {
    await supabase.from("pursuits").upsert({
      id: project.id,
      user_id: userId,
      title: project.title,
      hobby_slug: project.hobbySlug ?? null,
      sub_hobby: project.subHobby ?? null,
      interest: project.interest ?? null,
      custom_space: project.customSpace ?? null,
      inspired_by_post_id: project.inspiredByPostId ?? null,
      shared: !!project.shared,
      started_at: new Date(project.startedAt).toISOString(),
      finished_at: project.finishedAt ? new Date(project.finishedAt).toISOString() : null,
      goal_shape: project.goal?.shape ?? null,
      goal_label: project.goal?.label ?? null,
      goal_target_number: project.goal?.targetNumber ?? null,
      goal_unit: project.goal?.unit ?? null,
      goal_current: project.goal?.current ?? null,
      goal_verb: project.goal?.verb ?? null,
      goal_target_date: project.goal?.targetDate ? new Date(project.goal.targetDate).toISOString() : null,
      goal_reached_at: project.goal?.reachedAt ? new Date(project.goal.reachedAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    // The resting / check-in / ending-note columns go in their own write on
    // purpose. If the migration that adds them hasn't been run, this update
    // fails on its own and the core mirror above has already landed —
    // folding them into the upsert would make every mirror fail instead.
    await supabase
      .from("pursuits")
      .update({
        paused_at: project.pausedAt ? new Date(project.pausedAt).toISOString() : null,
        check_in_days: project.checkInDays ?? null,
        ending_note: project.endingNote ?? null,
      })
      .eq("id", project.id);
  } catch {
    // Best effort — the owner's own copy in the local journal is unaffected.
  }
}

export interface SharedPursuit {
  id: string;
  userId: string;
  title: string;
  hobbySlug?: string;
  subHobby?: string;
  interest?: string;
  customSpace?: string;
  startedAt: number;
  finishedAt?: number;
  goal?: Goal;
  pausedAt?: number;
  endingNote?: string;
}

/**
 * Files an update under a Pursuit both ways: the local journal (instant,
 * works offline, what the owner's own browser always reads first) and,
 * best-effort, the post's own row in the database (sql/pursuit-updates.sql's
 * pursuit_id) — the only copy of this link anyone else's browser, or the
 * owner's own on a different device, can ever see. A postId that isn't a
 * real database row (a local-only fallback post) simply has nothing to
 * update there; the local attach is what matters for that case anyway.
 */
export async function attachPostToPursuit(postId: number | string, pursuitId: string) {
  attachEntry(postId, pursuitId);
  if (!supabase) return;
  try {
    await supabase.from("posts").update({ pursuit_id: pursuitId }).eq("id", postId);
  } catch {
    // Best effort — the local journal's own copy of the link is unaffected.
  }
}

/** One Pursuit by id, for its own page — visible per the table's RLS (the
 * owner always, anyone else only when it's marked shared). Returns null
 * rather than throwing when it doesn't exist, isn't shared, or Supabase
 * isn't configured; the page falls back to the local journal or demo data. */
export async function fetchPursuitById(id: string): Promise<SharedPursuit | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("pursuits").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    const goal = rowToGoal(data);
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      hobbySlug: data.hobby_slug ?? undefined,
      subHobby: data.sub_hobby ?? undefined,
      interest: data.interest ?? undefined,
      customSpace: data.custom_space ?? undefined,
      startedAt: new Date(data.started_at).getTime(),
      finishedAt: data.finished_at ? new Date(data.finished_at).getTime() : undefined,
      goal,
      pausedAt: data.paused_at ? new Date(data.paused_at).getTime() : undefined,
      endingNote: data.ending_note ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Pulls every Pursuit the signed-in maker owns — shared or not, RLS lets the
 * owner see both — and folds any this browser doesn't already have into the
 * local journal. Called on sign-in (see AuthContext.tsx) so a Pursuit
 * started before a logout, then wiped from this browser by
 * clearLocalData(), comes back instead of looking deleted. Best-effort: an
 * unconfigured Supabase project, an offline moment, or a table that hasn't
 * been migrated yet all degrade to "nothing to restore" rather than an
 * error — signing in should never fail over this.
 */
export async function restoreOwnPursuits(userId: string) {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("pursuits")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });
    if (error || !data) return;
    mergeRemoteProjects((data as any[]).map(rowToProject));

    // Pursuits other people created that this person joined. Without this,
    // signing out and back in dropped every joined Pursuit from the list.
    const { data: memberships } = await supabase
      .from("pursuit_members")
      .select("pursuit_id")
      .eq("user_id", userId)
      .eq("status", "joined")
      .eq("role", "member");
    const ids = ((memberships as any[]) ?? []).map((m) => m.pursuit_id);
    if (ids.length) {
      const { data: joined } = await supabase.from("pursuits").select("*").in("id", ids);
      mergeRemoteProjects(
        ((joined as any[]) ?? []).map((row) => ({ ...rowToProject(row), ownerId: row.user_id, role: "member" as const })),
      );
    }
  } catch {
    // Best effort — the local journal is unaffected either way.
  }
}

/** A stranger's-eye view of one person's shared Pursuits — never their
 * private ones, enforced by the table's own row-level security as well as
 * this query. Returns [] rather than throwing when Supabase isn't
 * configured or the table doesn't exist yet. */
export async function fetchSharedPursuits(userId: string): Promise<SharedPursuit[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("pursuits")
      .select("*")
      .eq("user_id", userId)
      .eq("shared", true)
      .order("started_at", { ascending: false });
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      hobbySlug: row.hobby_slug ?? undefined,
      subHobby: row.sub_hobby ?? undefined,
      interest: row.interest ?? undefined,
      customSpace: row.custom_space ?? undefined,
      startedAt: new Date(row.started_at).getTime(),
      finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : undefined,
    }));
  } catch {
    return [];
  }
}

// ── Measured progress and pursuing together ──────────────────────────────
// Tables from supabase/migrations/20260923110000_pursuits_measured_and_shared.sql.
// Everything here is best-effort like the rest of this file: without the
// migration (or signed out) a Pursuit still works locally, solo.


/** Mirrors mode + measure (separate write, same reason as the check-in columns). */
export async function mirrorPursuitMeasure(projectId: string, mode: PursuitMode, measure?: Measure) {
  if (!supabase) return;
  try {
    await supabase.from("pursuits").update({ mode, measure: measure ?? null }).eq("id", projectId);
  } catch {
    // best effort
  }
}

export async function mirrorProgress(userId: string, e: ProgressEntry) {
  if (!supabase) return;
  try {
    await supabase.from("pursuit_progress").upsert({
      id: e.id,
      pursuit_id: e.projectId,
      user_id: userId,
      amount: e.amount,
      note: e.note ?? null,
      image_url: e.image && !e.image.startsWith("blob:") ? e.image : null,
      post_id: typeof e.postId === "number" ? e.postId : null,
      created_at: new Date(e.createdAt).toISOString(),
    });
  } catch {
    // best effort
  }
}

export async function deleteRemoteProgress(entryId: string) {
  if (!supabase) return;
  try {
    await supabase.from("pursuit_progress").delete().eq("id", entryId);
  } catch {
    // best effort
  }
}

/** Every participant's progress on one Pursuit. */
export async function fetchPursuitProgress(pursuitId: string): Promise<ProgressEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("pursuit_progress")
      .select("*")
      .eq("pursuit_id", pursuitId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      projectId: r.pursuit_id,
      userId: r.user_id,
      amount: Number(r.amount) || 0,
      note: r.note ?? undefined,
      image: r.image_url ?? undefined,
      postId: r.post_id ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
    }));
  } catch {
    return [];
  }
}

/** display_name / username / avatar for a set of user ids. A separate
 * query on purpose: pursuit_members.user_id and pursuits.user_id point at
 * auth.users, not profiles, so PostgREST can't embed profiles through
 * them — the embedded version errored and silently returned nothing, which
 * is why invites sent from a Pursuit's page never showed up. */
async function profilesById(ids: string[]) {
  const map = new Map<string, { username: string | null; displayName: string; avatarUrl?: string }>();
  if (!supabase || ids.length === 0) return map;
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
  for (const r of (data as any[]) ?? []) {
    map.set(r.id, {
      username: r.username ?? null,
      displayName: r.display_name?.trim() || r.username || "Someone",
      avatarUrl: r.avatar_url ?? undefined,
    });
  }
  return map;
}

/** Members with their profile names, owner first. */
export async function fetchPursuitMembers(pursuitId: string): Promise<PursuitMember[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("pursuit_members")
      .select("user_id, role, status")
      .eq("pursuit_id", pursuitId);
    if (error || !data) return [];
    const profiles = await profilesById((data as any[]).map((r) => r.user_id));
    return (data as any[])
      .map((r) => {
        const p = profiles.get(r.user_id);
        return {
          userId: r.user_id,
          username: p?.username ?? null,
          displayName: p?.displayName ?? "Someone",
          avatarUrl: p?.avatarUrl,
          status: r.status,
          role: r.role,
        } as PursuitMember;
      })
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  } catch {
    return [];
  }
}

/** Owner adds themselves plus invitees. Returns an error message or null. */
export async function saveInvites(pursuitId: string, ownerId: string, inviteeIds: string[]): Promise<string | null> {
  if (!supabase) return "Invites need an account.";
  try {
    const rows = [
      { pursuit_id: pursuitId, user_id: ownerId, role: "owner", status: "joined", invited_by: ownerId },
      ...inviteeIds
        .filter((id) => id !== ownerId)
        .map((id) => ({ pursuit_id: pursuitId, user_id: id, role: "member", status: "invited", invited_by: ownerId })),
    ];
    const { error } = await supabase.from("pursuit_members").upsert(rows, { onConflict: "pursuit_id,user_id", ignoreDuplicates: true });
    return error ? error.message : null;
  } catch (e: any) {
    return e?.message ?? "Invites didn't send.";
  }
}

export interface PursuitInvite {
  pursuitId: string;
  title: string;
  mode: PursuitMode;
  ownerName: string;
  ownerAvatar?: string;
}

/** Invites waiting for this person's answer. */
export async function fetchMyInvites(userId: string): Promise<PursuitInvite[]> {
  if (!supabase) return [];
  try {
    const { data: rows, error } = await supabase
      .from("pursuit_members")
      .select("pursuit_id")
      .eq("user_id", userId)
      .eq("status", "invited");
    if (error || !rows?.length) return [];
    const { data: pursuits } = await supabase
      .from("pursuits")
      .select("id, title, mode, user_id")
      .in("id", (rows as any[]).map((r) => r.pursuit_id));
    const list = (pursuits as any[]) ?? [];
    const owners = await profilesById([...new Set(list.map((p) => p.user_id))]);
    return list.map((p) => ({
      pursuitId: p.id,
      title: p.title,
      mode: (p.mode ?? "together") as PursuitMode,
      ownerName: owners.get(p.user_id)?.displayName ?? "Someone",
      ownerAvatar: owners.get(p.user_id)?.avatarUrl,
    }));
  } catch {
    return [];
  }
}

export async function answerInvite(pursuitId: string, userId: string, accept: boolean): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("pursuit_members")
      .update({ status: accept ? "joined" : "declined" })
      .eq("pursuit_id", pursuitId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

/** The full row for a Pursuit you were invited to, as a local Project. */
export async function fetchPursuitAsProject(pursuitId: string) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("pursuits").select("*").eq("id", pursuitId).maybeSingle();
    if (error || !data) return null;
    return {
      ...rowToProject(data),
      measure: (data.measure as Measure) ?? undefined,
      mode: (data.mode as PursuitMode) ?? "solo",
      ownerId: data.user_id as string,
    };
  } catch {
    return null;
  }
}

// ── Invite links ─────────────────────────────────────────────────────────
// supabase/migrations/20260923120000_pursuit_invite_links_and_notifications.sql

/** The shareable URL for a token. Hash routing, so it works from any host. */
export function inviteUrl(token: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/join/${token}`;
}

/** Reuses the Pursuit's active link if there is one, otherwise makes one. */
export async function getOrCreateInviteLink(pursuitId: string, userId: string): Promise<{ token?: string; error?: string }> {
  if (!supabase) return { error: "Invite links need an account." };
  try {
    const { data: existing } = await supabase
      .from("pursuit_invite_links")
      .select("token")
      .eq("pursuit_id", pursuitId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (existing?.[0]?.token) return { token: existing[0].token };
    const { data, error } = await supabase
      .from("pursuit_invite_links")
      .insert({ pursuit_id: pursuitId, created_by: userId })
      .select("token")
      .single();
    if (error || !data) return { error: error?.message ?? "Couldn't make a link." };
    return { token: data.token };
  } catch (e: any) {
    return { error: e?.message ?? "Couldn't make a link." };
  }
}

/** Stops a link working. The next "Copy invite link" makes a fresh one. */
export async function revokeInviteLinks(pursuitId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("pursuit_invite_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("pursuit_id", pursuitId)
      .is("revoked_at", null);
    return !error;
  } catch {
    return false;
  }
}

export interface InvitePreview {
  pursuitId: string;
  title: string;
  mode: PursuitMode;
  measure?: Measure;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  memberCount: number;
}

/** What /join/:token shows — works signed out. Null = link dead or unknown. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("pursuit_invite_preview", { invite_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return null;
    return {
      pursuitId: row.pursuit_id,
      title: row.title,
      mode: (row.mode ?? "solo") as PursuitMode,
      measure: row.measure ?? undefined,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerAvatar: row.owner_avatar ?? undefined,
      memberCount: row.member_count ?? 0,
    };
  } catch {
    return null;
  }
}

/** Joins via a link. Returns the Pursuit id, or an error to show. */
export async function joinViaLink(token: string): Promise<{ pursuitId?: string; error?: string }> {
  if (!supabase) return { error: "Joining needs an account." };
  try {
    const { data, error } = await supabase.rpc("join_pursuit_via_link", { invite_token: token });
    if (error) return { error: error.message };
    return { pursuitId: data as string };
  } catch (e: any) {
    return { error: e?.message ?? "Couldn't join." };
  }
}
