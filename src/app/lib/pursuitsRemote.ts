import { supabase } from "../../lib/supabase";
import { Project } from "./journal";

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
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Best effort — the owner's own copy in the local journal is unaffected.
  }
}

export interface SharedPursuit {
  id: string;
  title: string;
  hobbySlug?: string;
  subHobby?: string;
  interest?: string;
  customSpace?: string;
  startedAt: number;
  finishedAt?: number;
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
