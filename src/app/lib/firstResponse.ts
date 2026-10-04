import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";

/**
 * Step 4 · the team's backup queue — every new person's first moment from
 * the last 14 days that nobody has written a thought on yet, oldest first.
 * Admin-only; admin_first_moments_waiting() refuses anyone else.
 */
export interface WaitingFirstMoment {
  postId: number;
  authorName: string;
  inviterName: string | null;
  caption: string;
  hoursWaiting: number;
  /** False when it's followers-only and this admin doesn't follow them. */
  canView: boolean;
}

export async function fetchWaitingFirstMoments(): Promise<{ rows: WaitingFirstMoment[]; error: string | null }> {
  if (!supabase) return { rows: [], error: null };
  const { data, error } = await supabase.rpc("admin_first_moments_waiting");
  if (error) return { rows: [], error: friendlyError(error) };
  return {
    rows: (data ?? []).map((r: any) => ({
      postId: Number(r.post_id),
      authorName: r.author_name ?? "Someone",
      inviterName: r.inviter_name ?? null,
      caption: r.caption ?? "",
      hoursWaiting: Number(r.hours_waiting ?? 0),
      canView: !!r.admin_can_view,
    })),
    error: null,
  };
}
