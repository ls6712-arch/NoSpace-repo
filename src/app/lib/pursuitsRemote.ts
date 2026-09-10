import { supabase } from "../../lib/supabase";
import { Goal, GoalShape, Project, attachEntry } from "./journal";

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
      goal_target_date: project.goal?.targetDate ? new Date(project.goal.targetDate).toISOString() : null,
      goal_reached_at: project.goal?.reachedAt ? new Date(project.goal.reachedAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
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
    const goal: Goal | undefined = data.goal_shape
      ? {
          id: "",
          shape: data.goal_shape as GoalShape,
          label: data.goal_label ?? "",
          targetNumber: data.goal_target_number ?? undefined,
          unit: data.goal_unit ?? undefined,
          current: data.goal_current ?? undefined,
          targetDate: data.goal_target_date ? new Date(data.goal_target_date).getTime() : undefined,
          createdAt: 0,
          reachedAt: data.goal_reached_at ? new Date(data.goal_reached_at).getTime() : undefined,
        }
      : undefined;
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
    };
  } catch {
    return null;
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
