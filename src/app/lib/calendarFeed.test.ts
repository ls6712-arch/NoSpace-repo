// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: "2026-11-01T00:00:00Z" as string | null, error: null as { code?: string; message: string } | null })),
  row: null as { id: number } | null,
  error: null as { code?: string; message: string } | null,
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => db.rpc(fn, args),
    from: () => {
      const b: Record<string, unknown> = { select: () => b, eq: () => b, is: () => b, maybeSingle: async () => ({ data: db.row, error: db.error }) };
      return b;
    },
  },
}));

import { FEED_KEY, feedUrl, fetchFeedStatus, hashToken, localToken, makeToken, resetFeedLink } from "./calendarFeed";

beforeEach(() => {
  window.localStorage.clear();
  db.rpc.mockClear();
  db.row = null;
  db.error = null;
  vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
});

describe("the token", () => {
  it("is 43 URL safe characters, and different each time", () => {
    const a = makeToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(makeToken()).not.toBe(a);
  });

  it("encodes all 32 bytes without padding or characters a URL would change", () => {
    for (const fill of [0, 251, 255]) {
      expect(makeToken(() => new Uint8Array(32).fill(fill))).toBe(Buffer.alloc(32, fill).toString("base64url"));
    }
  });

  it("is hashed to 64 lower case hex characters, the same way each time", async () => {
    const h = await hashToken("A".repeat(43));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken("A".repeat(43))).toBe(h);
    expect(await hashToken("B".repeat(43))).not.toBe(h);
    // SHA-256 of the 43 character string, checked against node's own.
    const { createHash } = await import("node:crypto");
    expect(h).toBe(createHash("sha256").update("A".repeat(43)).digest("hex"));
  });
});

describe("the address", () => {
  it("is the function's, with the token", () => {
    expect(feedUrl("T".repeat(43), "https://abc.supabase.co/")).toBe(`https://abc.supabase.co/functions/v1/calendar-feed?token=${"T".repeat(43)}`);
  });
  it("is nothing when the app has no database address", () => {
    expect(feedUrl("T".repeat(43), "")).toBeNull();
  });
});

describe("making and resetting the link", () => {
  it("sends only the hash, keeps the token in this browser, and returns the address", async () => {
    const r = await resetFeedLink("u1");
    expect(r.url).toMatch(/^https:\/\/abc\.supabase\.co\/functions\/v1\/calendar-feed\?token=[A-Za-z0-9_-]{43}$/);
    const token = r.url!.split("token=")[1];
    expect(db.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = db.rpc.mock.calls[0];
    expect(fn).toBe("set_calendar_feed_token");
    expect(args).toEqual({ p_token_hash: await hashToken(token) });
    expect(JSON.stringify(args)).not.toContain(token);
    expect(localToken("u1")).toBe(token);
  });

  it("makes a different link on a reset", async () => {
    const a = (await resetFeedLink("u1")).url;
    const b = (await resetFeedLink("u1")).url;
    expect(a).not.toBe(b);
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(localToken("u1")).toBe(b!.split("token=")[1]);
  });

  it("says so, and keeps no token, when the database refuses", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    const r = await resetFeedLink("u1");
    expect(r.url).toBeUndefined();
    expect(r.error).toBeTruthy();
    expect(localToken("u1")).toBeNull();
  });

  it("says so when the migration is not live", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "no function" } });
    expect((await resetFeedLink("u1")).error).toBeTruthy();
  });
});

describe("what this browser remembers", () => {
  it("gives the token back only to the person it was made for", async () => {
    const t = (await resetFeedLink("u1")).url!.split("token=")[1];
    expect(localToken("u1")).toBe(t);
    expect(localToken("someone-else")).toBeNull();
  });
  it("ignores rubbish in the store", () => {
    window.localStorage.setItem(FEED_KEY, "{nope");
    expect(localToken("u1")).toBeNull();
    window.localStorage.setItem(FEED_KEY, JSON.stringify({ userId: "u1", token: "short" }));
    expect(localToken("u1")).toBeNull();
    expect(localToken("u1", null)).toBeNull();
  });
});

describe("status", () => {
  it("is active, none, or unavailable before the migration", async () => {
    db.row = { id: 1 };
    expect(await fetchFeedStatus("u1")).toBe("active");
    db.row = null;
    expect(await fetchFeedStatus("u1")).toBe("none");
    db.error = { code: "PGRST205", message: "no table" };
    expect(await fetchFeedStatus("u1")).toBe("unavailable");
    db.error = { code: "XX000", message: "boom" };
    expect(await fetchFeedStatus("u1")).toBe("none");
  });
});
