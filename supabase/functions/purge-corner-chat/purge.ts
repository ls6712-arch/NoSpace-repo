// The daily clean up of Corner chat's audit copies (migration 20261125000000_corner_message_removals.sql).
//
// A copy of a removed message is kept 30 days. When it is due, its photos go first, through the Storage
// API (a SQL delete cannot remove a Storage file), and only then the copy. If the Storage call fails, the
// copy stays and tomorrow's run tries again. Pure apart from the client it is handed, so it is tested
// without a network (purge.test.ts).

export const BUCKET = "corner-chat";
const BATCH = 200;
const MAX_BATCHES = 5;

/** The small part of the Supabase client this uses. */
export interface PurgeClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  storage: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface PurgeResult {
  /** Copies dropped. */
  purged: number;
  /** Photo files removed from Storage. */
  files: number;
  /** Set when a step failed; what was done before it stands. */
  error?: string;
}

export async function purgeDue(client: PurgeClient): Promise<PurgeResult> {
  const result: PurgeResult = { purged: 0, files: 0 };
  for (let i = 0; i < MAX_BATCHES; i++) {
    const due = await client.rpc("corner_removals_due", { p_limit: BATCH });
    if (due.error) return { ...result, error: due.error.message };
    const rows = (due.data ?? []) as { message_id: number; media_paths: string[] | null }[];
    if (rows.length === 0) break;

    const paths = rows.flatMap((r) => r.media_paths ?? []);
    if (paths.length > 0) {
      const removed = await client.storage.from(BUCKET).remove(paths);
      if (removed.error) return { ...result, error: removed.error.message };
      result.files += paths.length;
    }

    const done = await client.rpc("corner_removals_purged", { p_ids: rows.map((r) => r.message_id) });
    if (done.error) return { ...result, error: done.error.message };
    result.purged += Number(done.data ?? 0);
    if (rows.length < BATCH) break;
  }
  return result;
}
