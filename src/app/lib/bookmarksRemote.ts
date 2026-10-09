import { supabase } from "../../lib/supabase";
import { getSavedIds, replaceSaved } from "./journal";

/**
 * Saves, in the database (public.bookmarks, owner-only).
 *
 * A Save is still written on the phone first (lib/journal.ts) so it feels
 * instant. This file adds the database copy, which does two things:
 *   - a new save notifies the author ("3 people want to try ...", a count and
 *     never a name; see supabase/migrations/20261022000000_save_notification.sql);
 *   - your saves follow you to your other devices.
 *
 * Three kinds of write, and only the first can notify anyone:
 *   live        a save you just made             source 'live' (the default)
 *   local_sync  a save made before this existed  source 'local_sync'
 *   pending     a live save that could not be sent (offline), retried at the
 *               next open and sent as 'live': it is still a save you made
 *
 * The database ignores a repeat of the same save (ON CONFLICT DO NOTHING), so
 * a repeat never notifies twice.
 */

const BATCH = 200;
const syncedKey = (userId: string) => `soosh.saves-synced.${userId}`;
const pendingKey = (userId: string) => `soosh.saves-pending.${userId}`;

type Pending = Record<string, boolean>;

function readPending(userId: string): Pending {
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Pending) : {};
  } catch {
    return {};
  }
}

function writePending(userId: string, pending: Pending) {
  try {
    if (Object.keys(pending).length === 0) window.localStorage.removeItem(pendingKey(userId));
    else window.localStorage.setItem(pendingKey(userId), JSON.stringify(pending));
  } catch {
    // best effort
  }
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function writeOne(userId: string, postId: number, saved: boolean): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = saved
      ? await supabase
          .from("bookmarks")
          .upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
      : await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Mirrors one Save or un-Save to the database. If it cannot be sent, it is
 * remembered on this device and retried the next time the app opens. Signed
 * out, there is nothing to send.
 */
export async function syncBookmark(postId: number, saved: boolean): Promise<void> {
  if (!Number.isSafeInteger(postId)) return;
  const userId = await currentUserId();
  if (!userId) return;
  const ok = await writeOne(userId, postId, saved);
  const pending = readPending(userId);
  if (ok) {
    if (String(postId) in pending) {
      delete pending[String(postId)];
      writePending(userId, pending);
    }
  } else {
    writePending(userId, { ...pending, [String(postId)]: saved });
  }
}

/**
 * Runs when a signed-in person opens the app.
 *
 *  1. Once per device and account: sends the saves still kept only on this
 *     phone as source 'local_sync', which never notify and never count toward a
 *     notification. If any batch fails, nothing is cleared and the next open
 *     tries again.
 *  2. Retries saves and un-saves that could not be sent earlier.
 *  3. Reads the database list and makes this device match it. This is the only
 *     point the local list is replaced, and it is reached only after step 1
 *     wrote everything, so a failed write never loses a save.
 *
 * If the database cannot be read, the local list is left exactly as it was.
 */
export async function reconcileSaves(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    // 1. One-time upload of what only this device knows.
    if (window.localStorage.getItem(syncedKey(userId)) !== "1") {
      const local = getSavedIds().filter((id) => Number.isSafeInteger(id));
      for (let i = 0; i < local.length; i += BATCH) {
        const rows = local
          .slice(i, i + BATCH)
          .map((post_id) => ({ user_id: userId, post_id, source: "local_sync" }));
        const { error } = await supabase
          .from("bookmarks")
          .upsert(rows, { onConflict: "user_id,post_id", ignoreDuplicates: true });
        if (error) return;
      }
      window.localStorage.setItem(syncedKey(userId), "1");
    }

    // 2. Anything that was waiting to be sent.
    let pending = readPending(userId);
    for (const [key, saved] of Object.entries(pending)) {
      if (await writeOne(userId, Number(key), saved)) {
        const { [key]: _sent, ...rest } = pending;
        pending = rest;
      }
    }
    writePending(userId, pending);

    // 3. Make this device match the database.
    const { data, error } = await supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error || !data) return;
    const ids = data.map((row) => Number(row.post_id));
    const merged = ids.filter((id) => pending[String(id)] !== false);
    for (const [key, saved] of Object.entries(pending)) {
      if (saved && !merged.includes(Number(key))) merged.unshift(Number(key));
    }
    replaceSaved(merged);
  } catch {
    // Offline or signed out partway: the local list is untouched, try next open.
  }
}
