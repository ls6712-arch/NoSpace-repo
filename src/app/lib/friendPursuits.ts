import { supabase } from "../../lib/supabase";
import type { Measure, ProgressEntry } from "./journal";
import { pursuitCorner, summarize, formatAmount, unitFor } from "./pursuitProgress";
import { profilesById } from "./pursuitsRemote";

/** One card on Discover's "Your friends are doing". */
export interface FriendPursuit {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  /** The Pursuit's Corner when it has one, else its own title. */
  what: string;
  /** "3 of 10 loaves", or nothing when the Pursuit has no measure. */
  progress?: string;
}

/** "3 of 10 loaves", from a Pursuit's measure and what has been logged on it. */
export function progressLine(measure: Measure | undefined, entries: ProgressEntry[]): string | undefined {
  if (!measure || !(measure.target > 0)) return undefined;
  const s = summarize(measure, entries);
  const current = Math.min(s.current, s.target);
  return `${formatAmount(current)} of ${formatAmount(s.target)} ${unitFor(measure, s.target)}`;
}

/**
 * Pursuits that people you follow share and are still working on, newest
 * activity first. The table's own row-level security already limits this to
 * Pursuits marked shared; nothing private is read. Best effort: any failure is
 * an empty list, and Discover hides the section.
 */
export async function fetchFriendPursuits(followingIds: string[], limit = 10): Promise<FriendPursuit[]> {
  if (!supabase || followingIds.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from("pursuits")
      .select("id, user_id, title, interest, sub_hobby, measure, mode")
      .in("user_id", followingIds)
      .eq("shared", true)
      .is("finished_at", null)
      .is("let_go_at", null)
      .is("paused_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data || data.length === 0) return [];
    const rows = data as {
      id: string;
      user_id: string;
      title: string;
      interest: string | null;
      sub_hobby: string | null;
      measure: Measure | null;
      mode: string | null;
    }[];
    const ids = rows.map((r) => r.id);
    const [people, progress] = await Promise.all([
      profilesById([...new Set(rows.map((r) => r.user_id))]),
      supabase.from("pursuit_progress").select("pursuit_id, user_id, amount").in("pursuit_id", ids),
    ]);
    const entriesBy = new Map<string, ProgressEntry[]>();
    for (const e of (progress.data as { pursuit_id: string; user_id: string; amount: number }[] | null) ?? []) {
      const list = entriesBy.get(e.pursuit_id) ?? [];
      list.push({ id: "", projectId: e.pursuit_id, userId: e.user_id, amount: Number(e.amount) || 0, createdAt: 0 } as ProgressEntry);
      entriesBy.set(e.pursuit_id, list);
    }
    return rows.map((r) => {
      const who = people.get(r.user_id);
      const all = entriesBy.get(r.id) ?? [];
      // A group Pursuit counts everyone together; side by side counts only the owner's own.
      const mine = r.mode === "group" ? all : all.filter((e) => e.userId === r.user_id);
      return {
        id: r.id,
        ownerId: r.user_id,
        ownerName: who?.displayName ?? "Someone",
        ownerAvatar: who?.avatarUrl,
        what: pursuitCorner({ interest: r.interest ?? undefined, subHobby: r.sub_hobby ?? undefined }) ?? r.title,
        progress: progressLine(r.measure ?? undefined, mine),
      };
    });
  } catch {
    return [];
  }
}
