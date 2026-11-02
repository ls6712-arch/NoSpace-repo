import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake PostgREST chain for personal_picks: the first select can fail (the new columns aren't live yet).
const calls = vi.hoisted(() => ({ selects: [] as string[], orders: [] as string[], failNew: false, rows: [] as Record<string, unknown>[] }));
vi.mock("../../lib/supabase", () => {
  const chain = (columns: string) => {
    const q = {
      gte: () => q,
      order: (col: string) => (calls.orders.push(col), q),
      limit: async () =>
        calls.failNew && columns.includes("kind") ? { data: null, error: { message: "column personal_picks.kind does not exist" } } : { data: calls.rows, error: null },
    };
    return q;
  };
  return {
    supabase: { from: () => ({ select: (c: string) => (calls.selects.push(c), chain(c)) }), auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
    supabaseUrl: "https://proj.supabase.co",
    supabaseAnonKey: "anon",
  };
});

import { askStubbyStream, fetchMyPicks, type AskStep } from "./stubbyAsk";

const NOW = Date.UTC(2026, 10, 1, 22);
const row = (over: Record<string, unknown> = {}) => ({ id: 1, title: "Wheel night", place: null, starts_at: new Date(NOW + 3_600_000).toISOString(), ends_at: null, price: "$10", url: "https://example.com/w", note: null, ...over });

beforeEach(() => {
  calls.selects.length = 0;
  calls.orders.length = 0;
  calls.failNew = false;
  calls.rows = [];
});

describe("fetchMyPicks", () => {
  it("reads kind, why and soonest-after, the latest ask first and best fit first", async () => {
    calls.rows = [row({ kind: "idea", why: "No booking.", soonest_after: true, rank: 0, ask_id: 9 })];
    const [p] = await fetchMyPicks(NOW);
    expect(p).toMatchObject({ kind: "idea", why: "No booking.", after: true });
    expect(calls.orders).toEqual(["ask_id", "rank", "starts_at"]);
  });

  it("before the migration is live, falls back to the old columns, soonest first, as events", async () => {
    calls.failNew = true;
    calls.rows = [row()];
    const [p] = await fetchMyPicks(NOW);
    expect(calls.selects).toHaveLength(2);
    expect(calls.selects[1]).not.toContain("kind");
    expect(p).toMatchObject({ kind: "event", why: null, after: false });
  });
});

describe("askStubbyStream", () => {
  const sse = (text: string, size = 23) => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < text.length; i += size) c.enqueue(new TextEncoder().encode(text.slice(i, i + size)));
        c.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
  };

  it("streams the steps in order, even split across chunks, and resolves with the report", async () => {
    const body = [
      'event: understood\ndata: {"when":"tonight","who":"solo","budget":12,"free":false}\n\n',
      ": keepalive\n\n",
      'event: search\ndata: {"type":"search","query":"pottery tonight"}\n\n',
      'event: pages\ndata: {"type":"pages","count":9}\n\n',
      'event: picking\ndata: {"type":"picking"}\n\n',
      'event: done\ndata: {"picks":[{},{}],"asksLeft":2,"outcome":"found","askId":42}\n\n',
    ].join("");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string)).toEqual({ mode: "ask", ask: "pottery tonight", stream: true });
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
      return sse(body);
    });
    vi.stubGlobal("fetch", fetchMock);
    const got: AskStep[] = [];
    const r = await askStubbyStream("pottery tonight", { onStep: (s) => got.push(s) });
    expect(got).toEqual([
      { type: "understood", understood: { when: "tonight", who: "solo", budget: 12, free: false } },
      { type: "search", query: "pottery tonight" },
      { type: "pages", count: 9 },
      { type: "picking" },
    ]);
    expect(r).toEqual({ found: 2, asksLeft: 2, error: null, outcome: "found", askId: 42 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://proj.supabase.co/functions/v1/stubby-scout");
    vi.unstubAllGlobals();
  });

  it("passes on an error event, and a plain error answer (no asks left)", async () => {
    vi.stubGlobal("fetch", async () => sse('event: error\ndata: {"error":"The search took too long.","status":504}\n\n'));
    expect((await askStubbyStream("pottery", { onStep: () => undefined })).error).toBe("The search took too long.");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "That's 3 for today. I'll look again tomorrow." }), { status: 429, headers: { "content-type": "application/json" } }));
    expect((await askStubbyStream("pottery", { onStep: () => undefined })).error).toBe("That's 3 for today. I'll look again tomorrow.");
    vi.unstubAllGlobals();
  });

  it("rejects when stopped, so the caller knows it was a Stop and not an error", async () => {
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      return sse("");
    });
    const c = new AbortController();
    c.abort();
    await expect(askStubbyStream("pottery", { signal: c.signal, onStep: () => undefined })).rejects.toThrow("aborted");
    vi.unstubAllGlobals();
  });
});

