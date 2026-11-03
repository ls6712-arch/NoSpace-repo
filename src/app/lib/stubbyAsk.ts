import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseAnonKey, supabaseUrl } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { STUBBY_UPDATING, STUBBY_VERSION, STUBBY_VERSION_HEADER } from "../../../supabase/functions/_shared/stubbyVersion.ts";

/**
 * Asking Stubby for something different (supabase/functions/stubby-scout, mode "ask";
 * migration 20261101180000). What a person types is sent once to the search and not kept;
 * what Stubby finds is saved as their own picks (personal_picks), which only they can read
 * or remove, and which are deleted two days after they happen.
 */

/** The day's allowance before the server says otherwise (mode "status"). Members and Stubby accounts. */
export const ASKS_PER_DAY = 6;
/** A guest's allowance before the server says otherwise. */
export const GUEST_ASKS_PER_DAY = 3;
export const ASK_MAX_LENGTH = 200;

/** Which client Stubby talks through: the main one, or the guest's own (src/lib/guestSupabase.ts). */
type Client = SupabaseClient | null;

/** Why an ask was refused before searching (the server's 429 or 403 code). */
export type LimitCode = "GUEST_LIMIT_REACHED" | "USER_LIMIT_REACHED" | "GUEST_GLOBAL_CAP" | "GLOBAL_CAP" | "SIGNUP_REQUIRED";
export interface AskLimit {
  code: LimitCode;
  /** When the oldest ask in the last 24 hours ages out, if there is one. */
  resetsAt: number | null;
}
const LIMIT_CODES: readonly LimitCode[] = ["GUEST_LIMIT_REACHED", "USER_LIMIT_REACHED", "GUEST_GLOBAL_CAP", "GLOBAL_CAP", "SIGNUP_REQUIRED"];

/** Reads a refusal's code and reset time, or null if it isn't one. */
export function readLimit(body: unknown): AskLimit | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { code?: unknown; resetsAt?: unknown };
  if (typeof b.code !== "string" || !(LIMIT_CODES as readonly string[]).includes(b.code)) return null;
  const at = typeof b.resetsAt === "string" ? Date.parse(b.resetsAt) : NaN;
  return { code: b.code as LimitCode, resetsAt: Number.isFinite(at) ? at : null };
}

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
  /** Stubby thinks it's better with a friend (solo asks only), for the nudge. */
  betterWithFriend: boolean;
  /** Its Corner as "space-slug/corner-slug", when it has one: Make it a plan files the plan there. */
  cornerKey: string | null;
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
  betterWithFriend: r.better_with_friend === true,
  cornerKey: r.corners?.space_slug && r.corners?.slug ? `${r.corners.space_slug}/${r.corners.slug}` : null,
});

const BASE_COLUMNS = "id, title, place, starts_at, ends_at, price, url, note, created_at, corners(space_slug, slug)";
/** Newest first: each migration's columns, then the ones before it, so the app works while one isn't live yet. */
const COLUMN_TIERS: { columns: string; ranked: boolean }[] = [
  { columns: `${BASE_COLUMNS}, kind, why, soonest_after, rank, ask_id, better_with_friend`, ranked: true },
  { columns: `${BASE_COLUMNS}, kind, why, soonest_after, rank, ask_id`, ranked: true },
  { columns: BASE_COLUMNS, ranked: false },
];

/**
 * Your picks from Stubby that haven't ended yet: the latest ask's first, best fit first within
 * an ask, then soonest. Before the smarter-picks migration is live, the old columns, soonest
 * first. Best effort: none on any failure.
 */
export async function fetchMyPicks(now = Date.now(), client: Client = supabase): Promise<MyPick[]> {
  if (!client) return [];
  const since = new Date(now - 6 * 3_600_000).toISOString();
  const read = (columns: string, ranked: boolean) => {
    let q = client.from("personal_picks").select(columns).gte("starts_at", since);
    if (ranked) q = q.order("ask_id", { ascending: false, nullsFirst: false }).order("rank", { ascending: true, nullsFirst: false });
    return q.order("starts_at", { ascending: true }).limit(50);
  };
  try {
    let data: unknown = null;
    let error: unknown = true;
    for (const t of COLUMN_TIERS) {
      ({ data, error } = await read(t.columns, t.ranked));
      if (!error) break;
    }
    if (error || !Array.isArray(data)) return [];
    return (data as unknown as Record<string, any>[]).map(toPick).filter((p) => (p.endsAt ?? p.startsAt + 3 * 3_600_000) >= now);
  } catch {
    return [];
  }
}

/** How many asks are left in the last 24 hours. Before the migration is live, the full amount. */
export async function asksLeft(now = Date.now(), client: Client = supabase, perDay = ASKS_PER_DAY): Promise<number> {
  if (!client) return perDay;
  try {
    const { count, error } = await client
      .from("stubby_asks")
      .select("id", { count: "exact", head: true })
      .gte("asked_at", new Date(now - 24 * 3_600_000).toISOString());
    if (error) return perDay;
    return Math.max(0, perDay - (count ?? 0));
  } catch {
    return perDay;
  }
}

/** The bearer token for this client's session, or null. */
async function tokenOf(client: Client): Promise<string | null> {
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Sent on every call to stubby-scout: the function answers another version with "Stubby is updating". */
export const STUBBY_HEADERS: Record<string, string> = { [STUBBY_VERSION_HEADER]: STUBBY_VERSION };

/**
 * After a call with the version header failed before any answer: true when the function answers the
 * same harmless status call without the header. Then it is a function older than this app (its CORS
 * doesn't allow the header yet), not a lost connection. Uses no ask and searches nothing.
 */
export async function olderFunction(token: string, doFetch: typeof fetch = fetch): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    await doFetch(`${supabaseUrl}/functions/v1/stubby-scout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
      body: JSON.stringify({ mode: "ask", status: true }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks left today and the day's allowance, from the server (an ask with status: no search, no ask
 * used), so a limit changed in the function's settings shows without a new build. Null without a session.
 */
export async function askStatus(client: Client = supabase): Promise<{ left: number; perDay: number; accountPerDay: number; resetsAt: number | null } | null> {
  const token = await tokenOf(client);
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/stubby-scout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: supabaseAnonKey, ...STUBBY_HEADERS },
      // An ask with no words and status: the function before this one answers 400, never a search.
      body: JSON.stringify({ mode: "ask", status: true }),
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { asksLeft?: unknown; perDay?: unknown; accountPerDay?: unknown; resetsAt?: unknown };
    if (typeof b.asksLeft !== "number" || typeof b.perDay !== "number") return null;
    const at = typeof b.resetsAt === "string" ? Date.parse(b.resetsAt) : NaN;
    return { left: b.asksLeft, perDay: b.perDay, accountPerDay: typeof b.accountPerDay === "number" ? b.accountPerDay : ASKS_PER_DAY, resetsAt: Number.isFinite(at) ? at : null };
  } catch {
    return null;
  }
}

export async function removeMyPick(id: number, client: Client = supabase): Promise<{ error: string | null }> {
  if (!client) return { error: null };
  const { error } = await client.from("personal_picks").delete().eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

/** A thumbs up or down on a pick, or a Keep. Only the pick and the signal are sent; the database fills the rest. */
export async function sendFeedback(pickId: number, signal: "up" | "down" | "save", client: Client = supabase): Promise<boolean> {
  if (!client) return false;
  try {
    const { error } = await client.from("stubby_feedback").insert({ pick_id: pickId, signal });
    // Already given (the unique index): that's fine.
    return !error || error.code === "23505";
  } catch {
    return false;
  }
}

/** The 8 mood ids (src/app/data/moods.ts); the database takes nothing else. */
export type Interest = "make" | "move" | "people" | "alone" | "outside" | "learn" | "play" | "haveIt";
export type Timing = "tonight" | "weekend" | "anytime";
export interface Taste {
  city: string | null;
  interests: Interest[];
  timing: Timing | null;
}
const INTERESTS: readonly Interest[] = ["make", "move", "people", "alone", "outside", "learn", "play", "haveIt"];

/**
 * Your taste profile (stubby_profiles), null if there isn't one yet, or undefined when it can't be
 * read (no table yet before the guest migration, offline). Unknown is not empty: the quick-context
 * card only shows for a known-empty profile, so members never see it on a database without it.
 */
export async function readTaste(client: Client = supabase): Promise<Taste | null | undefined> {
  if (!client) return undefined;
  try {
    const { data, error } = await client.from("stubby_profiles").select("city, interests, timing").maybeSingle();
    if (error) return undefined;
    if (!data) return null;
    const r = data as { city: string | null; interests: string[] | null; timing: string | null };
    return {
      city: r.city ?? null,
      interests: (r.interests ?? []).filter((i): i is Interest => (INTERESTS as readonly string[]).includes(i)),
      timing: r.timing === "tonight" || r.timing === "weekend" || r.timing === "anytime" ? r.timing : null,
    };
  } catch {
    return undefined;
  }
}

/** True when Stubby knows nothing about you yet: the quick-context card shows. */
export const tasteIsEmpty = (t: Taste | null) => !t || (!t.city && t.interests.length === 0 && !t.timing);

/** No coordinates, ever: a city name only, 80 characters at most. */
export function cleanCityName(v: string): string | null {
  const s = v.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (s.length < 2 || /\d+[.,]\d+/.test(s)) return null;
  return s;
}

/** Saves your taste profile (your own row only). Skip saves nothing. */
export async function saveTaste(t: Taste, client: Client = supabase): Promise<boolean> {
  if (!client) return false;
  const { data } = await client.auth.getUser();
  const id = data.user?.id;
  if (!id) return false;
  const row = {
    user_id: id,
    city: t.city ? cleanCityName(t.city) : null,
    interests: t.interests.filter((i) => (INTERESTS as readonly string[]).includes(i)).slice(0, 10),
    timing: t.timing,
  };
  const { error } = await client.from("stubby_profiles").upsert(row, { onConflict: "user_id" });
  return !error;
}

/** Asks Stubby. On success, how many he found and asks left; the picks themselves are re-read from the table. */
export async function askStubby(text: string): Promise<{ found: number; asksLeft: number | null; error: string | null; outcome?: AskOutcome }> {
  const ask = text.trim().slice(0, ASK_MAX_LENGTH);
  if (ask.length < 2) return { found: 0, asksLeft: null, error: "Say what you’re after, like pottery on Saturday." };
  if (!supabase) return { found: 0, asksLeft: null, error: "Stubby needs the live app." };
  const { data, error } = await supabase.functions.invoke("stubby-scout", { body: { mode: "ask", ask }, headers: STUBBY_HEADERS });
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
  /** A follow-up that cost nothing (the first after an ask). */
  free?: boolean;
  /** Stubby needs one answer first; nothing was searched and no ask was used. */
  question?: "setting" | "who" | "when" | "what";
  /** When nothing fits: the 3 most common kinds of reason, with counts. */
  reasons?: { key: string; count: number }[];
  /** Refused before searching: the daily limit, the guest cap, or a feature that needs an account. */
  limit?: AskLimit;
  /** Guests aren't open (the function's startup check): shown as "Log in to use Stubby", not an error. */
  closed?: boolean;
  /** The time he understood ("tonight", "weekend"...), for which "nothing fits" line to say. */
  when?: string | null;
  /** 21+ things were asked for and left out: no 21+ birthdate on file (never for a guest). */
  adultsLeftOut?: boolean;
}

/** The person's answer to Stubby's one question. */
export interface AskAnswers {
  who?: "solo" | "partner" | "friends" | "family";
  /** tonight, tomorrow, weekend, or a picked day "YYYY-MM-DD". */
  when?: string;
  /** Surprise me, or an answer typed into the ask. */
  skip?: boolean;
  /** The answer to "Stay in or head out?". */
  setting?: "in" | "out";
  /** Who they said earlier this session (the chip): below what they type now. */
  rememberedWho?: "solo" | "partner" | "friends" | "family";
}

/** A follow-up on the deck. The first after an ask is free. */
export interface AskFollowUp {
  of: number;
  kind: "cheaper" | "closer" | "later" | "different" | "more";
  titles: string[];
}

const readError = (body: unknown): string | null => (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null);

function resultOf(
  r: { picks?: unknown[]; asksLeft?: number; outcome?: unknown; askId?: unknown; free?: unknown; question?: unknown; reasons?: unknown; understood?: { when?: unknown }; adultsLeftOut?: unknown } | null,
): AskResult {
  const asksLeft = typeof r?.asksLeft === "number" ? r.asksLeft : null;
  if (r?.question === "setting" || r?.question === "who" || r?.question === "when" || r?.question === "what") return { found: 0, asksLeft, error: null, question: r.question };
  const found = Array.isArray(r?.picks) ? r!.picks!.length : 0;
  const outcome: AskOutcome = r?.outcome === "after" || r?.outcome === "nothing" || r?.outcome === "found" ? r.outcome : found > 0 ? "found" : "nothing";
  const reasons = Array.isArray(r?.reasons)
    ? (r!.reasons as unknown[]).filter((x): x is { key: string; count: number } => !!x && typeof (x as { key?: unknown }).key === "string" && typeof (x as { count?: unknown }).count === "number").slice(0, 3)
    : [];
  const when = typeof r?.understood?.when === "string" ? r.understood.when : null;
  return { found, asksLeft, error: null, outcome, askId: typeof r?.askId === "number" ? r.askId : undefined, free: r?.free === true, reasons, when, ...(r?.adultsLeftOut === true ? { adultsLeftOut: true } : {}) };
}

/**
 * Asks Stubby and streams his steps to `onStep` as they happen: what he understood, each
 * search, the pages read, then that he's picking. Resolves with the same result as askStubby.
 * Aborting (`signal`, the Stop button) stops listening; the ask was paid for and still counts.
 */
export async function askStubbyStream(
  text: string,
  {
    signal,
    onStep,
    answers,
    questions,
    followUp,
    client = supabase,
  }: { signal?: AbortSignal; onStep: (s: AskStep) => void; answers?: AskAnswers | null; questions?: boolean; followUp?: AskFollowUp | null; client?: Client },
): Promise<AskResult> {
  const ask = text.trim().slice(0, ASK_MAX_LENGTH);
  if (ask.length < 2) return { found: 0, asksLeft: null, error: "Say what you’re after, like pottery on Saturday." };
  if (!client || !supabaseUrl || !supabaseAnonKey) return { found: 0, asksLeft: null, error: "Stubby needs the live app." };
  const token = await tokenOf(client);
  if (!token) return { found: 0, asksLeft: null, error: "Sign in first." };

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/stubby-scout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: supabaseAnonKey, ...STUBBY_HEADERS },
      body: JSON.stringify({ mode: "ask", ask, stream: true, ...(answers ? { answers } : {}), ...(questions ? { questions: true } : {}), ...(followUp ? { followUp } : {}) }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    // A function older than this app turns the stubby-version header away before the ask is sent.
    if (await olderFunction(token)) return { found: 0, asksLeft: null, error: STUBBY_UPDATING.error };
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
    if (!res.ok) {
      const limit = readLimit(body);
      if (limit) return { found: 0, asksLeft: limit.code === "SIGNUP_REQUIRED" ? null : 0, error: null, limit };
      // Guests aren't open yet (the function's startup check): the usual line, nothing new.
      if (body && typeof body === "object" && (body as { code?: unknown }).code === "GUESTS_NOT_READY") {
        return { found: 0, asksLeft: null, error: null, closed: true };
      }
      return { found: 0, asksLeft: null, error: readError(body) ?? "Stubby couldn’t look just now. Try again in a bit." };
    }
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

