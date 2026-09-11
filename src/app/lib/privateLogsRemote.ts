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

export async function fetchPrivateLogs(userId: string): Promise<PrivateLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("private_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function createPrivateLog(
  userId: string,
  input: {
    note: string;
    media?: { url: string; type: "image" | "video"; hobbySlug?: string };
    projectId?: string;
  },
): Promise<PrivateLog | null> {
  if (!supabase) return null;
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
  if (error || !data) return null;
  return fromRow(data);
}

export async function deletePrivateLog(logId: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("private_logs").delete().eq("id", logId);
  return !error;
}
