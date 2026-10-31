import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { ERROR_LINE } from "./stateCopy";

/**
 * The private subscribe link (calendar brief section 6). The token is made in
 * this browser and kept in this browser; the database only ever gets its
 * SHA-256, so it cannot rebuild a link, and a new device cannot show an old one
 * (it offers Reset link). The link is the edge function's address with the token.
 */
export const FEED_KEY = "soosh.calendar.feed.v1";
export const FEED_FUNCTION = "calendar-feed";

/** 32 random bytes as base64url, 43 characters: what the feed accepts. */
export function makeToken(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(32);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The address to subscribe to, or null when the app has no database address to point at. */
export function feedUrl(token: string, base: string | undefined = import.meta.env.VITE_SUPABASE_URL as string | undefined): string | null {
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/functions/v1/${FEED_FUNCTION}?token=${encodeURIComponent(token)}`;
}

const store = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** The token this browser holds for this person, or null. */
export function localToken(userId: string, s: Pick<Storage, "getItem"> | null = store()): string | null {
  try {
    const v = JSON.parse(s?.getItem(FEED_KEY) ?? "null") as { userId?: unknown; token?: unknown } | null;
    return v && v.userId === userId && typeof v.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(v.token) ? v.token : null;
  } catch {
    return null;
  }
}

function keepToken(userId: string, token: string): void {
  try {
    store()?.setItem(FEED_KEY, JSON.stringify({ userId, token }));
  } catch {
    // Private mode: the link works, but this browser cannot show it again.
  }
}

// PostgREST: PGRST205 no such table; PGRST202 no such function. Postgres: 42P01, 42883.
const notDeployed = (code?: string) => ["PGRST205", "PGRST202", "42P01", "42883"].includes(code ?? "");

export type FeedStatus = "unavailable" | "none" | "active";

/** Whether the person has an active link. "unavailable" before the migration is live: the section then stays out of sight. */
export async function fetchFeedStatus(userId: string): Promise<FeedStatus> {
  if (!supabase) return "unavailable";
  try {
    const { data, error } = await supabase.from("calendar_feed_tokens").select("id").eq("user_id", userId).is("revoked_at", null).maybeSingle();
    if (error) return notDeployed(error.code) ? "unavailable" : "none";
    return data ? "active" : "none";
  } catch {
    return "unavailable";
  }
}

/** Makes a new link, which revokes the old one, and keeps its token in this browser. */
export async function resetFeedLink(userId: string): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: ERROR_LINE };
  try {
    const token = makeToken();
    const { error } = await supabase.rpc("set_calendar_feed_token", { p_token_hash: await hashToken(token) });
    if (error) return { error: notDeployed(error.code) ? ERROR_LINE : friendlyError(error) };
    keepToken(userId, token);
    const url = feedUrl(token);
    return url ? { url } : { error: ERROR_LINE };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}
