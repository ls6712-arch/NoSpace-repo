import { supabase } from "../../lib/supabase";

/**
 * Private Logs, for a signed-in owner, live only in the `private_logs`
 * table (sql/private-logs.sql) — never in localStorage. Unlike
 * pursuitsRemote.ts/profileLinksRemote.ts, this is not a best-effort
 * mirror of a local-first store: the table is the only copy, which is the
 * whole point (a private log used to sit in localStorage under
 * `nospace.journal.v1`, tied to no account, and could leak to the next
 * person signed in on a shared device). RLS on this table requires
 * `auth.uid() = user_id` for every operation and grants no public or
 * friends-only read path at all, so a signed-out visitor can't reach this
 * file's functions meaningfully — see context/PrivateLogsContext.tsx for
 * the signed-out, local-only fallback that exists for that case.
 */

export interface PrivateLog {
  id: number;
  note: string;
  media?: string;
  mediaType?: "image" | "video";
  hobbySlug?: string;
  projectId?: string;
  createdAt: number;
}

function fromRow(row: any): PrivateLog {
  return {
    id: row.id,
    note: row.body ?? "",
    media: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    hobbySlug: row.hobby_slug ?? undefined,
    projectId: row.project_id ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Every function below returns its failure reason rather than discarding
 * it — a caller that only checked for `null`/`false` couldn't tell "there's
 * nothing here" apart from "the write actually failed," which is how a
 * failed save once still showed a success screen. */
export interface RemoteResult<T> {
  data: T | null;
  error: string | null;
}

export async function fetchPrivateLogs(userId: string): Promise<RemoteResult<PrivateLog[]>> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("private_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[privateLogsRemote] fetchPrivateLogs failed:", error);
    return { data: null, error: error.message };
  }
  return { data: (data ?? []).map(fromRow), error: null };
}

export async function createPrivateLog(
  userId: string,
  input: {
    note: string;
    media?: { url: string; type: "image" | "video"; hobbySlug?: string };
    projectId?: string;
  },
): Promise<RemoteResult<PrivateLog>> {
  if (!supabase) return { data: null, error: "Supabase isn't configured for this build." };
  const { data, error } = await supabase
    .from("private_logs")
    .insert({
      user_id: userId,
      body: input.note,
      media_url: input.media?.url ?? null,
      media_type: input.media?.type ?? null,
      hobby_slug: input.media?.hobbySlug ?? null,
      project_id: input.projectId ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[privateLogsRemote] createPrivateLog failed:", error);
    return { data: null, error: error.message };
  }
  if (!data) {
    console.error("[privateLogsRemote] createPrivateLog: insert returned no row and no error");
    return { data: null, error: "The save didn't come back with a result." };
  }
  return { data: fromRow(data), error: null };
}

export async function deletePrivateLog(logId: number): Promise<RemoteResult<true>> {
  if (!supabase) return { data: null, error: "Supabase isn't configured for this build." };
  const { error } = await supabase.from("private_logs").delete().eq("id", logId);
  if (error) {
    console.error("[privateLogsRemote] deletePrivateLog failed:", error);
    return { data: null, error: error.message };
  }
  return { data: true, error: null };
}
