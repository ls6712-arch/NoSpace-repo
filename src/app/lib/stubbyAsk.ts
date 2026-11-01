import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";

/**
 * Asking Stubby for something different (supabase/functions/stubby-scout, mode "ask";
 * migration 20261101180000). What a person types is sent once to the search and not kept;
 * what Stubby finds is saved as their own picks (personal_picks), which only they can read
 * or remove, and which are deleted two days after they happen.
 */

export const ASKS_PER_DAY = 3;
export const ASK_MAX_LENGTH = 200;

export interface MyPick {
  id: number;
  title: string;
  place: string | null;
  startsAt: number;
  endsAt: number | null;
  price: string | null;
  url: string;
  note: string | null;
}

const toPick = (r: Record<string, any>): MyPick => ({
  id: r.id,
  title: r.title,
  place: r.place ?? null,
  startsAt: Date.parse(r.starts_at),
  endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
  price: r.price ?? null,
  url: r.url,
  note: r.note ?? null,
});

/** Your picks from Stubby that haven't ended yet, soonest first. Best effort: none on any failure. */
export async function fetchMyPicks(now = Date.now()): Promise<MyPick[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("personal_picks")
      .select("id, title, place, starts_at, ends_at, price, url, note")
      .gte("starts_at", new Date(now - 6 * 3_600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, any>[]).map(toPick).filter((p) => (p.endsAt ?? p.startsAt + 3 * 3_600_000) >= now);
  } catch {
    return [];
  }
}

/** How many asks are left in the last 24 hours. Before the migration is live, the full amount. */
export async function asksLeft(now = Date.now()): Promise<number> {
  if (!supabase) return ASKS_PER_DAY;
  try {
    const { count, error } = await supabase
      .from("stubby_asks")
      .select("id", { count: "exact", head: true })
      .gte("asked_at", new Date(now - 24 * 3_600_000).toISOString());
    if (error) return ASKS_PER_DAY;
    return Math.max(0, ASKS_PER_DAY - (count ?? 0));
  } catch {
    return ASKS_PER_DAY;
  }
}

export async function removeMyPick(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("personal_picks").delete().eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

/** Asks Stubby. On success, how many he found and asks left; the picks themselves are re-read from the table. */
export async function askStubby(text: string): Promise<{ found: number; asksLeft: number | null; error: string | null }> {
  const ask = text.trim().slice(0, ASK_MAX_LENGTH);
  if (ask.length < 2) return { found: 0, asksLeft: null, error: "Say what you’re after, like pottery on Saturday." };
  if (!supabase) return { found: 0, asksLeft: null, error: "Stubby needs the live app." };
  const { data, error } = await supabase.functions.invoke("stubby-scout", { body: { mode: "ask", ask } });
  if (error) {
    let message: string | null = null;
    try {
      const body = await (error as { context?: Response }).context?.json?.();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      message = null;
    }
    return { found: 0, asksLeft: null, error: message ?? "Stubby couldn’t look just now. Try again in a bit." };
  }
  const r = data as { picks?: unknown[]; asksLeft?: number } | null;
  return { found: Array.isArray(r?.picks) ? r!.picks!.length : 0, asksLeft: typeof r?.asksLeft === "number" ? r.asksLeft : null, error: null };
}
