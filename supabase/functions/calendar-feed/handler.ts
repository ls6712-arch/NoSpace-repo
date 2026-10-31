import { buildFeed, FEED_DAYS, type FeedPlan } from "./feed.ts";

/**
 * The calendar feed's request handling, with everything it needs from outside
 * passed in, so it runs the same in the edge function and in tests.
 */
export interface FeedDeps {
  /** The person a token's hash belongs to, when that token has not been reset. */
  userForTokenHash: (hash: string) => Promise<string | null>;
  plansFor: (userId: string, fromMs: number, toMs: number) => Promise<FeedPlan[]>;
  now?: () => number;
}

/** 32 random bytes as base64url: how the app makes a token. Anything else is not one. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const plain = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra } });

/**
 * GET (or HEAD) with `?token=`. A token that is malformed, unknown or reset all
 * get the same plain "Not found", so the feed says nothing about which tokens exist.
 */
export async function handleFeed(req: Request, deps: FeedDeps): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "Method not allowed", { allow: "GET, HEAD" });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return plain(404, "Not found");
  try {
    const userId = await deps.userForTokenHash(await sha256Hex(token));
    if (!userId) return plain(404, "Not found");
    const now = (deps.now ?? Date.now)();
    const plans = await deps.plansFor(userId, now, now + FEED_DAYS * 86_400_000);
    const body = buildFeed(plans, now);
    return new Response(req.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="soosh.ics"',
        // Calendars ask again by themselves; a short cache keeps a burst of polls cheap.
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return plain(500, "Something went wrong. Try again.");
  }
}
