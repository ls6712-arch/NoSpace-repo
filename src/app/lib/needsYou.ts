import { supabase } from "../../lib/supabase";
import { lastActivityAt } from "./pursuitTrail";
import { pursuitStatus, type Project } from "./journal";

export const QUIET_AFTER_DAYS = 35;
const DAY = 86400000;

export interface QuietPursuit {
  id: string;
  title: string;
  weeks: number;
}

/** Active Pursuits with nothing logged for 5 weeks or more. A nudge, never a score. */
export function quietPursuits(projects: readonly Project[], momentsFor: (p: Project) => { createdAt: number }[], now = Date.now()): QuietPursuit[] {
  return projects
    .filter((p) => pursuitStatus(p) === "active")
    .map((p) => ({ p, days: Math.floor((now - lastActivityAt(p, momentsFor(p))) / DAY) }))
    .filter(({ days }) => days >= QUIET_AFTER_DAYS)
    .map(({ p, days }) => ({ id: p.id, title: p.title, weeks: Math.floor(days / 7) }));
}

export interface JoinRequest {
  pursuitId: string;
  pursuitTitle: string;
  userId: string;
}

/** People waiting to be let into open groups you run. Best effort: any failure is an empty list. */
export async function fetchJoinRequestsForMe(userId: string): Promise<JoinRequest[]> {
  if (!supabase) return [];
  try {
    const { data: mine, error } = await supabase.from("pursuits").select("id, title").eq("user_id", userId).eq("visibility", "open");
    if (error || !mine || mine.length === 0) return [];
    const { data: rows } = await supabase
      .from("pursuit_members")
      .select("pursuit_id, user_id")
      .in("pursuit_id", mine.map((m) => m.id as string))
      .eq("status", "requested");
    const title = new Map(mine.map((m) => [m.id as string, m.title as string]));
    return (rows ?? []).map((r) => ({ pursuitId: r.pursuit_id as string, pursuitTitle: title.get(r.pursuit_id as string) ?? "", userId: r.user_id as string }));
  } catch {
    return [];
  }
}

const KEY = "soosh.needsyou.answered.v1";

/** What you have already answered here, kept on this device so a handled card stays gone. */
export function answeredIds(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function markAnswered(id: string) {
  try {
    const next = [...answeredIds(), id].slice(-200);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private window: the card just comes back next visit
  }
}
