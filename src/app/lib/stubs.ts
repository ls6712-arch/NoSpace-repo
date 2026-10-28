import { supabase } from "../../lib/supabase";

/** A Stub as the database holds it (migration 20261101000000). */
export interface StubRow {
  id: number;
  kind: "event" | "session" | "gold";
  serial: number | null;
  postId?: number;
  pursuitId?: string;
}

/**
 * The session Stub a posted Moment earned, if any. The database issues it when
 * the Moment is saved with a Pursuit, a moment after the insert returns, so this
 * looks a few times before giving up. Null when none was issued (no Pursuit, or
 * the migration is not live yet).
 */
export async function fetchStubForPost(postId: number, tries = 4, waitMs = 450): Promise<StubRow | null> {
  const client = supabase;
  if (!client) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const { data, error } = await client
        .from("stubs")
        .select("id, kind, serial, post_id, pursuit_id")
        .eq("post_id", postId)
        .eq("kind", "session")
        .maybeSingle();
      // 42703 and 42P01: the columns or table are not there yet; no point asking again.
      if (error) return null;
      if (data) {
        const r = data as { id: number; kind: StubRow["kind"]; serial: number | null; post_id: number | null; pursuit_id: string | null };
        return { id: r.id, kind: r.kind, serial: r.serial, postId: r.post_id ?? undefined, pursuitId: r.pursuit_id ?? undefined };
      }
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return null;
}

/** Who has loved a Moment, oldest first. Best effort: an empty list when it cannot be read. */
export async function fetchLovers(postId: number): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("reactions").select("user_id, created_at").eq("post_id", postId).eq("type", "love").order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as { user_id: string }[]).map((r) => r.user_id);
  } catch {
    return [];
  }
}
