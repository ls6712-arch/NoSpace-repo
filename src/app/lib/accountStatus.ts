import { supabase } from "../../lib/supabase";
import { OFFLINE_LINE } from "./stateCopy";

/** Extra profile columns the owner's own profile load reads. Both are
 * readable on the row already (see 20261031000000_profiles_column_privacy). */
export const ACCOUNT_STATUS_COLUMNS = "paused_at, deletion_requested_at";

/** Days between asking to delete and the nightly job removing the account
 * for good. Must match purge_deleted_accounts() in
 * supabase/migrations/20261103000000_account_deletion_purge.sql. */
export const DELETION_GRACE_DAYS = 14;

/** When a deletion asked for at `requestedAt` becomes permanent. */
export function deletionDate(requestedAt: string | Date): Date {
  const d = new Date(requestedAt);
  return new Date(d.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

type Result = { error: string | null };

async function setOwnColumn(
  userId: string,
  fields: { paused_at?: string | null; deletion_requested_at?: string | null },
): Promise<Result> {
  if (!supabase) return { error: "Accounts aren't available right now." };
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", userId)
      .select("id");
    if (error) return { error: error.message };
    // RLS hides a row it won't let you touch: zero rows means nothing changed.
    if (!data || data.length === 0) return { error: "That didn't save. Try again." };
    return { error: null };
  } catch {
    return { error: OFFLINE_LINE };
  }
}

/** Hides the account from everyone. The caller signs out everywhere next. */
export const pauseAccount = (userId: string) =>
  setOwnColumn(userId, { paused_at: new Date().toISOString() });

export const unpauseAccount = (userId: string) => setOwnColumn(userId, { paused_at: null });

/** Starts the grace period: hidden now, removed for good after it ends. */
export const requestAccountDeletion = (userId: string) =>
  setOwnColumn(userId, { deletion_requested_at: new Date().toISOString() });

export const cancelAccountDeletion = (userId: string) =>
  setOwnColumn(userId, { deletion_requested_at: null });
