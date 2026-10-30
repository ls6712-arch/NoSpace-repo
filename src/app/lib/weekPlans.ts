import { supabase } from "../../lib/supabase";
import type { WeekPlan } from "./homeWeek";

const DAY = 86_400_000;

/**
 * What the person has already said yes to in the next 7 days: events they are
 * going to, and the next session of a Pursuit they own or have joined. Their
 * own rows only. Best effort: a failure is an empty list, and the Your week
 * card then just shows their free time.
 */
export async function fetchWeekPlans(userId: string, now = Date.now()): Promise<WeekPlan[]> {
  if (!supabase) return [];
  const from = new Date(now).toISOString();
  const to = new Date(now + 7 * DAY).toISOString();
  const plans: WeekPlan[] = [];
  try {
    const { data: rsvps } = await supabase.from("event_rsvps").select("event_id").eq("user_id", userId);
    const eventIds = ((rsvps ?? []) as { event_id: number }[]).map((r) => r.event_id);
    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from("space_events")
        .select("title, starts_at, status")
        .in("id", eventIds)
        .gt("starts_at", from)
        .lte("starts_at", to);
      for (const e of (events ?? []) as { title: string; starts_at: string; status: string }[]) {
        if (e.status !== "cancelled") plans.push({ title: e.title, startsAt: Date.parse(e.starts_at) });
      }
    }

    const [{ data: joined }, { data: owned }] = await Promise.all([
      supabase.from("pursuit_members").select("pursuit_id").eq("user_id", userId).eq("status", "joined"),
      supabase.from("pursuits").select("id").eq("user_id", userId).is("finished_at", null).is("let_go_at", null),
    ]);
    const pursuitIds = [
      ...new Set([...((joined ?? []) as { pursuit_id: string }[]).map((r) => r.pursuit_id), ...((owned ?? []) as { id: string }[]).map((r) => r.id)]),
    ];
    if (pursuitIds.length > 0) {
      const [{ data: sessions }, { data: pursuits }] = await Promise.all([
        supabase.from("pursuit_sessions").select("pursuit_id, starts_at").in("pursuit_id", pursuitIds).gt("starts_at", from).lte("starts_at", to),
        supabase.from("pursuits").select("id, title").in("id", pursuitIds),
      ]);
      const titles = new Map(((pursuits ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
      for (const s of (sessions ?? []) as { pursuit_id: string; starts_at: string }[]) {
        const title = titles.get(s.pursuit_id);
        if (title) plans.push({ title, startsAt: Date.parse(s.starts_at) });
      }
    }
  } catch {
    return plans;
  }
  return plans.filter((p) => Number.isFinite(p.startsAt)).sort((a, b) => a.startsAt - b.startsAt);
}
