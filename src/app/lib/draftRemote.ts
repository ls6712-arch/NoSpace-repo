import { supabase } from "../../lib/supabase";
import { MomentDraftFields } from "./draftStore";

/**
 * The local draft (draftStore.ts) is the source of truth for the owner's
 * own device — it works instantly, with or without an account. This file is
 * the one place that talks to the `moment_drafts` table (sql/drafts.sql),
 * used only for the one thing local storage can't do: recover the same
 * caption/audience/Corner/event fields from a different device. The
 * attached photo/video never travels through here — see draftMedia.ts.
 *
 * Every function here is best-effort. A signed-out visitor, an unconfigured
 * Supabase project, or a table that hasn't been migrated yet all degrade to
 * "no remote draft" rather than an error — the local draft never depends on
 * any of this succeeding.
 */
function toRow(userId: string, fields: MomentDraftFields) {
  return {
    user_id: userId,
    thought: fields.thought,
    hobby_slug: fields.hobbySlug || null,
    sub_hobby: fields.subHobby || null,
    interest: fields.interest,
    space_set: fields.spaceSet,
    audience: fields.audience,
    circle_id: fields.circleId ?? null,
    is_activity: fields.isActivity,
    starts_at: fields.startsAt,
    location_name: fields.locationName,
    location_privacy: fields.locationPrivacy,
    project_id: fields.projectId,
    project_title: fields.projectTitle,
    media_type: fields.mediaType,
    updated_at: new Date(fields.updatedAt).toISOString(),
  };
}

function fromRow(row: any): MomentDraftFields {
  return {
    thought: row.thought ?? "",
    hobbySlug: row.hobby_slug ?? "",
    subHobby: row.sub_hobby ?? "",
    interest: row.interest ?? "",
    spaceSet: !!row.space_set,
    audience: row.audience ?? "private",
    circleId: row.circle_id ?? undefined,
    isActivity: !!row.is_activity,
    startsAt: row.starts_at ?? "",
    locationName: row.location_name ?? "",
    locationPrivacy: row.location_privacy ?? "neighborhood",
    projectId: row.project_id ?? "",
    projectTitle: row.project_title ?? "",
    mediaType: row.media_type ?? null,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** Best-effort mirror of the draft's text fields. Not awaited by callers
 * that don't need to know whether it landed. */
export async function mirrorDraft(userId: string, fields: MomentDraftFields) {
  if (!supabase) return;
  try {
    await supabase.from("moment_drafts").upsert(toRow(userId, fields));
  } catch {
    // Best effort — the local draft is unaffected.
  }
}

/** The signed-in person's own draft, from wherever it was last saved. */
export async function fetchRemoteDraft(userId: string): Promise<MomentDraftFields | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("moment_drafts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return fromRow(data);
  } catch {
    return null;
  }
}

export async function clearRemoteDraft(userId: string) {
  if (!supabase) return;
  try {
    await supabase.from("moment_drafts").delete().eq("user_id", userId);
  } catch {
    // Best effort — the local draft is unaffected.
  }
}
