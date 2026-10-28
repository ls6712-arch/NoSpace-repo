import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { ERROR_LINE } from "./stateCopy";

/**
 * Open-group Pursuits, shared sessions ("Next together") and join requests
 * (migration 20261031000000). Every call is best effort: before that migration
 * is live, or signed out, the lists are empty and the sheet falls back to
 * starting a Pursuit of your own.
 */

export interface OpenPursuit {
  pursuitId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  capacity: number;
  /** People in it, the host included. */
  taken: number;
  endsAt?: number;
  session?: { id: number; startsAt: number; place?: string };
  people: { name: string; avatarUrl?: string }[];
  /** Your own row: "joined", "requested", "declined" or nothing. */
  mine?: string;
}

export async function fetchOpenPursuits(hobbySlug: string, subHobby: string, limit = 5): Promise<OpenPursuit[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("open_pursuits_for_corner", {
      p_hobby_slug: hobbySlug,
      p_sub_hobby: subHobby,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, any>[]).map((r) => ({
      pursuitId: r.pursuit_id,
      title: r.title,
      ownerId: r.owner_id,
      ownerName: r.owner_name,
      capacity: Number(r.capacity) || 0,
      taken: Number(r.taken) || 0,
      endsAt: r.ends_at ? new Date(r.ends_at).getTime() : undefined,
      session: r.session_id
        ? { id: Number(r.session_id), startsAt: new Date(r.session_starts_at).getTime(), place: r.session_place ?? undefined }
        : undefined,
      people: ((r.people as { name: string; avatar?: string | null }[] | null) ?? []).map((p) => ({ name: p.name, avatarUrl: p.avatar ?? undefined })),
      mine: r.mine ?? undefined,
    }));
  } catch {
    return [];
  }
}

/** Joins at once or sends a request; the host decides once more than half the spots are taken. */
export async function joinOpenPursuit(pursuitId: string): Promise<{ status?: "joined" | "requested"; error?: string }> {
  if (!supabase) return { error: ERROR_LINE };
  try {
    const { data, error } = await supabase.rpc("join_open_pursuit", { p_pursuit_id: pursuitId });
    if (error) return { error: friendlyError(error) };
    return { status: data === "requested" ? "requested" : "joined" };
  } catch {
    return { error: ERROR_LINE };
  }
}

export async function answerJoinRequest(pursuitId: string, userId: string, accept: boolean): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = await supabase.rpc("answer_join_request", { p_pursuit_id: pursuitId, p_user_id: userId, p_accept: accept });
    return error ? friendlyError(error) : null;
  } catch {
    return ERROR_LINE;
  }
}

/** The visibility columns, written apart from the main row so a missing column never blocks creating a Pursuit. */
export async function mirrorPursuitOpen(
  pursuitId: string,
  fields: { visibility: "open" | "friends" | "solo"; capacity?: number; endsAt?: number },
) {
  if (!supabase) return;
  try {
    await supabase
      .from("pursuits")
      .update({
        visibility: fields.visibility,
        capacity: fields.visibility === "open" ? (fields.capacity ?? 8) : null,
        ends_at: fields.endsAt ? new Date(fields.endsAt).toISOString() : null,
      })
      .eq("id", pursuitId);
  } catch {
    // best effort
  }
}

export interface PursuitSession {
  id: number;
  pursuitId: string;
  startsAt: number;
  place?: string;
  note?: string;
  going: { userId: string }[];
}

/** The next upcoming session of a Pursuit, with who is in. Null when none, or before the migration. */
export async function fetchNextSession(pursuitId: string): Promise<PursuitSession | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("pursuit_sessions")
      .select("id, pursuit_id, starts_at, place, note")
      .eq("pursuit_id", pursuitId)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const s = data[0] as { id: number; pursuit_id: string; starts_at: string; place: string | null; note: string | null };
    const rsvps = await supabase.from("pursuit_session_rsvps").select("user_id").eq("session_id", s.id);
    return {
      id: s.id,
      pursuitId: s.pursuit_id,
      startsAt: new Date(s.starts_at).getTime(),
      place: s.place ?? undefined,
      note: s.note ?? undefined,
      going: ((rsvps.data as { user_id: string }[] | null) ?? []).map((r) => ({ userId: r.user_id })),
    };
  } catch {
    return null;
  }
}

export async function setImIn(sessionId: number, userId: string, going: boolean): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = going
      ? await supabase.from("pursuit_session_rsvps").insert({ session_id: sessionId, user_id: userId })
      : await supabase.from("pursuit_session_rsvps").delete().eq("session_id", sessionId).eq("user_id", userId);
    return error ? friendlyError(error) : null;
  } catch {
    return ERROR_LINE;
  }
}

export async function saveSession(
  pursuitId: string,
  userId: string,
  fields: { startsAt: number; place?: string; note?: string },
): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = await supabase.from("pursuit_sessions").insert({
      pursuit_id: pursuitId,
      starts_at: new Date(fields.startsAt).toISOString(),
      place: fields.place?.trim().slice(0, 120) || null,
      note: fields.note?.trim().slice(0, 140) || null,
      created_by: userId,
    });
    return error ? friendlyError(error) : null;
  } catch {
    return ERROR_LINE;
  }
}

/** "6 of 8 spots": people in it of its capacity. */
export function spotsLine(taken: number, capacity: number): string {
  return `${taken} of ${capacity} spots`;
}

/** Whether another person would join at once (true) or need the host's answer (false). */
export function joinsInstantly(taken: number, capacity: number): boolean {
  return taken * 2 <= capacity;
}
