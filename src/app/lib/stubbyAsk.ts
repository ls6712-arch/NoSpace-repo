import { supabase, supabaseAnonKey, supabaseUrl } from "../../lib/supabase";
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
  /** An event (a dated thing with its own page) or an idea (do-it-yourself, no booking). */
  kind: "event" | "idea";
  /** Why it fits this person, in one line. */
  why: string | null;
  /** One of the soonest after tonight, shown because nothing fit tonight. */
  after: boolean;
  /** Which ask found it (null before the smarter-picks migration). */
  askId: number | null;
  /** When it was saved, for "Earlier today". */
  createdAt: number | null;
}

/** How an ask went: picks in the time asked for, only the soonest after tonight, or nothing. */
export type AskOutcome = "found" | "after" | "nothing";

const toPick = (r: Record<string, any>): MyPick => ({
  id: r.id,
  title: r.title,
  place: r.place ?? null,
  startsAt: Date.parse(r.starts_at),
  endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
  price: r.price ?? null,
  url: r.url,
  note: r.note ?? null,
  kind: r.kind === "idea" ? "idea" : "event",
  why: typeof r.why === "string" ? r.why : null,
  after: r.soonest_after === true,
  askId: typeof r.ask_id === "number" ? r.ask_id : null,
  createdAt: r.created_at ? Date.parse(r.created_at) : null,
});

const NEW_COLUMNS = "id, title, place, starts_at, ends_at, price, url, note, kind, why, soonest_after, rank, ask_id, created_at";
const OLD_COLUMNS = "id, title, place, starts_at, ends_at, price, url, note, created_at";

/**
 * Your picks from Stubby that haven't ended yet: the latest ask's first, best fit first within
 * an ask, then soonest. Before the smarter-picks migration is live, the old columns, soonest
 * first. Best effort: none on any failure.
 */
export async function fetchMyPicks(now = Date.now()): Promise<MyPick[]> {
  if (!supabase) return [];
  const since = new Date(now - 6 * 3_600_000).toISOString();
  const read = (columns: string, ranked: boolean) => {
    let q = supabase!.from("personal_picks").select(columns).gte("starts_at", since);
    if (ranked) q = q.order("ask_id", { ascending: false, nullsFirst: false }).order("rank", { ascending: true, nullsFirst: false });
    return q.order("starts_at", { ascending: true }).limit(50);
  };
  try {
    let { data, error } = await read(NEW_COLUMNS, true);
    if (error) ({ data, error } = await read(OLD_COLUMNS, false));
    if (error || !Array.isArray(data)) return [];
    return (data as unknown as Record<string, any>[]).map(toPick).filter((p) => (p.endsAt ?? p.startsAt + 3 * 3_600_000) >= now);
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
export async function askStubby(text: string): Promise<{ found: number; asksLeft: number | null; error: string | null; outcome?: AskOutcome }> {
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
  const r = data as { picks?: unknown[]; asksLeft?: number; outcome?: unknown } | null;
  const found = Array.isArray(r?.picks) ? r!.picks!.length : 0;
  const outcome: AskOutcome = r?.outcome === "after" || r?.outcome === "nothing" || r?.outcome === "found" ? r.outcome : found > 0 ? "found" : "nothing";
  return { found, asksLeft: typeof r?.asksLeft === "number" ? r.asksLeft : null, error: null, outcome };
}

// ── streaming: Stubby's steps while he looks (Stubby plan §7) ─────────────

/** What Stubby understood from the ask, at once, before any search. */
export interface Understood {
  when: string | null;
  who: "solo" | "partner" | "friends" | "family" | null;
  budget: number | null;
  free: boolean;
}

/** One step from the stream, as it happens. */
export type AskStep = { type: "understood"; understood: Understood } | { type: "search"; query: string } | { type: "pages"; count: number } | { type: "picking" };

export interface AskResult {
  found: number;
  asksLeft: number | null;
  error: string | null;
  outcome?: AskOutcome;
  askId?: number;
}

const readError = (body: unknown): string | null => (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null);

function resultOf(r: { picks?: unknown[]; asksLeft?: number; outcome?: unknown; askId?: unknown } | null): AskResult {
  const found = Array.isArray(r?.picks) ? r!.picks!.length : 0;
  const outcome: AskOutcome = r?.outcome === "after" || r?.outcome === "nothing" || r?.outcome === "found" ? r.outcome : found > 0 ? "found" : "nothing";
  return { found, asksLeft: typeof r?.asksLeft === "number" ? r.asksLeft : null, error: null, outcome, askId: typeof r?.askId === "number" ? r.askId : undefined };
}

/**
 * Asks Stubby and streams his steps to `onStep` as they happen: what he understood, each
 * search, the pages read, then that he's picking. Resolves with the same result as askStubby.
 * Aborting (`signal`, the Stop button) stops listening; the ask was paid for and still counts.
 */
export async function askStubbyStream(text: string, { signal, onStep }: { signal?: AbortSignal; onStep: (s: AskStep) => void }): Promise<AskResult> {
  const ask = text.trim().slice(0, ASK_MAX_LENGTH);
  if (ask.length < 2) return { found: 0, asksLeft: null, error: "Say what you’re after, like pottery on Saturday." };
  if (!supabase || !supabaseUrl || !supabaseAnonKey) return { found: 0, asksLeft: null, error: "Stubby needs the live app." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { found: 0, asksLeft: null, error: "Sign in first." };

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/stubby-scout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
      body: JSON.stringify({ mode: "ask", ask, stream: true }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { found: 0, asksLeft: null, error: "Stubby couldn’t look just now. Try again in a bit." };
  }
  // Stopped before searching (no asks left, a bad ask), or an older function: a plain answer.
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream") || !res.body) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) return { found: 0, asksLeft: null, error: readError(body) ?? "Stubby couldn’t look just now. Try again in a bit." };
    return resultOf(body as Parameters<typeof resultOf>[0]);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AskResult | null = null;
  const handle = (event: string, payload: any) => {
    if (event === "understood") onStep({ type: "understood", understood: payload as Understood });
    else if (event === "search" && typeof payload?.query === "string") onStep({ type: "search", query: payload.query });
    else if (event === "pages" && typeof payload?.count === "number") onStep({ type: "pages", count: payload.count });
    else if (event === "picking") onStep({ type: "picking" });
    else if (event === "done") final = resultOf(payload);
    else if (event === "error") final = { found: 0, asksLeft: null, error: readError(payload) ?? "Something went wrong. Try again in a bit." };
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        handle(event, JSON.parse(data));
      } catch {
        // A line that isn't JSON: skip it.
      }
    }
    if (done) break;
  }
  return final ?? { found: 0, asksLeft: null, error: "Stubby couldn’t finish looking. Try again in a bit." };
}

