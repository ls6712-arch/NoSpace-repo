// Stubby plan §7: an ask streams its steps. The search call reads the model's own stream and
// reports each search, the pages read and the start of the picks; the handler sends them on as
// server-sent events, then the report.
import { describe, expect, it, vi } from "vitest";
import { EMPTY_PROFILE, handleScout, type ScoutDeps } from "./handler.ts";
import { linkKey, nyLocalToMs } from "./picks.ts";
import { runSearch, type SearchProgress } from "./search.ts";

const NOW = nyLocalToMs("2026-11-01T17:00");
const PAGE = "https://nycgovparks.org/events/wheel-night";

/** A fake streamed reply from the model, as server-sent events. */
function sseReply(events: Record<string, unknown>[], chunkAt = 37) {
  const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  // Split at odd places, so an event can arrive in pieces.
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += chunkAt) chunks.push(body.slice(i, i + chunkAt));
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const picksText = `<picks>[{"kind":"event","title":"Drop-in wheel night","starts":"2026-11-01T19:00","ends":"2026-11-01T21:00","price":"Free","url":"${PAGE}","why":"Close by."}]</picks>`;
const MODEL_EVENTS = [
  { type: "message_start", message: { usage: { input_tokens: 900, output_tokens: 1 } } },
  { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "s1", name: "web_search", input: {} } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query": "drop-in pot' } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: 'tery tonight brooklyn"}' } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: PAGE, title: "Wheel night" }, { type: "web_search_result", url: "https://example.org/other", title: "Other" }] } },
  { type: "content_block_stop", index: 1 },
  { type: "content_block_start", index: 2, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: "Here you go. " } },
  { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: picksText.slice(0, 20) } },
  { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: picksText.slice(20) } },
  { type: "content_block_delta", index: 2, delta: { type: "citations_delta", citation: { type: "web_search_result_location", url: "https://example.org/cited" } } },
  { type: "content_block_stop", index: 2 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 250 } },
  { type: "message_stop" },
];

describe("the streamed search", () => {
  it("reports each search, the pages and the picks as they happen, and rebuilds the same answer", async () => {
    const steps: SearchProgress[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).stream).toBe(true);
      return sseReply(MODEL_EVENTS);
    });
    const r = await runSearch({ apiKey: "k", model: "m", maxSearches: 5, focus: null, cornerNames: [], now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, onProgress: (e) => steps.push(e) });
    expect(steps.map((s) => s.type)).toEqual(["search", "pages", "picking"]);
    expect(steps[0]).toEqual({ type: "search", query: "drop-in pottery tonight brooklyn" });
    expect(steps[1]).toEqual({ type: "pages", count: 2 });
    expect(r.text).toBe(`Here you go. ${picksText}`);
    expect(r.searches).toBe(1);
    expect(r.sourceLinks.has(linkKey(PAGE)!)).toBe(true);
    expect(r.sourceLinks.has(linkKey("https://example.org/cited")!)).toBe(true);
    expect(r.usage).toEqual({ input: 900, output: 251 });
  });

  it("carries on after a pause with the rebuilt blocks, as the plain call does", async () => {
    const bodies: { messages: { role: string; content: unknown }[] }[] = [];
    let call = 0;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      call += 1;
      if (call === 1) {
        return sseReply([
          MODEL_EVENTS[1], MODEL_EVENTS[2], MODEL_EVENTS[3], MODEL_EVENTS[4],
          { type: "message_delta", delta: { stop_reason: "pause_turn" }, usage: { output_tokens: 10 } },
        ]);
      }
      return sseReply(MODEL_EVENTS);
    });
    const r = await runSearch({ apiKey: "k", model: "m", maxSearches: 5, focus: null, cornerNames: [], now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, onProgress: () => undefined });
    expect(call).toBe(2);
    expect(bodies[1].messages[1]).toEqual({ role: "assistant", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "drop-in pottery tonight brooklyn" } }] });
    expect(r.searches).toBe(2);
  });

  it("turns a stream error into a plain message", async () => {
    const fetchImpl = async () => sseReply([{ type: "error", error: { type: "overloaded_error", message: "x" } }]);
    await expect(runSearch({ apiKey: "k", model: "m", maxSearches: 5, focus: null, cornerNames: [], now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, onProgress: () => undefined })).rejects.toThrow(
      "The search service is busy. Try again in a few minutes.",
    );
  });

  it("doesn't stream without onProgress (the admin and morning runs)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).stream).toBeUndefined();
      return new Response(JSON.stringify({ content: [{ type: "text", text: "<picks>[]</picks>" }], stop_reason: "end_turn" }), { status: 200 });
    });
    const r = await runSearch({ apiKey: "k", model: "m", maxSearches: 5, focus: null, cornerNames: [], now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.text).toBe("<picks>[]</picks>");
  });
});

// ── the handler ───────────────────────────────────────────────────────────

/** Reads a server-sent event response into [event, data] pairs. */
async function readEvents(res: Response): Promise<[string, any][]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.startsWith("event:"))
    .map((b) => {
      const [e, d] = b.split("\n");
      return [e.slice(7), JSON.parse(d.slice(6))];
    });
}

function deps(search: ScoutDeps["search"], over: Partial<ScoutDeps["server"]> = {}): { d: ScoutDeps; asks: unknown[] } {
  const asks: unknown[] = [];
  return {
    asks,
    d: {
      settings: { enabled: true, hasKey: true, runsPerDay: 3, maxSearches: 5, restockSearches: 3, asksPerPerson: 3, asksPerDay: 200 },
      now: () => NOW,
      userId: async () => "user-1",
      db: { runsSince: async () => 0, startRun: async () => 1, finishRun: async () => undefined, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => true, profile: async () => EMPTY_PROFILE },
      server: {
        claimSource: async () => null,
        claimAsk: async () => 42,
        finishRun: async () => undefined,
        finishAsk: async (id, r) => void asks.push({ id, ...r }),
        asksSince: async () => 1,
        trustedHosts: async () => [],
        corners: async () => [],
        existingKeys: async () => new Set(),
        insertPick: async () => true,
        insertPersonal: async () => true,
        ...over,
      },
      search,
    },
  };
}
const post = (body: unknown) => new Request("https://fn.example.com/stubby-scout", { method: "POST", headers: { authorization: "Bearer x" }, body: JSON.stringify(body) });

describe("an ask that streams", () => {
  it("sends understood at once, then each step, then the report with its ask id", async () => {
    const { d } = deps(async (r) => {
      r.onProgress?.({ type: "search", query: "pottery tonight" });
      r.onProgress?.({ type: "pages", count: 9 });
      r.onProgress?.({ type: "picking" });
      return { text: picksText, sourceLinks: new Set([linkKey(PAGE)!]), searches: 1 };
    });
    const res = await handleScout(post({ mode: "ask", ask: "pottery tonight", stream: true }), d);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readEvents(res);
    expect(events.map(([e]) => e)).toEqual(["understood", "search", "pages", "picking", "done"]);
    expect(events[0][1]).toMatchObject({ when: "tonight" });
    expect(events[1][1]).toEqual({ type: "search", query: "pottery tonight" });
    expect(events[2][1]).toEqual({ type: "pages", count: 9 });
    expect(events[4][1]).toMatchObject({ askId: 42, outcome: "found", picks: [{ title: "Drop-in wheel night" }] });
  });

  it("still says it's picking when the search didn't (a plain reply)", async () => {
    const { d } = deps(async () => ({ text: "<picks>[]</picks>", sourceLinks: new Set(), searches: 1 }));
    const events = await readEvents(await handleScout(post({ mode: "ask", ask: "pottery tonight", stream: true }), d));
    expect(events.map(([e]) => e)).toEqual(["understood", "picking", "done"]);
    expect(events[2][1]).toMatchObject({ outcome: "nothing" });
  });

  it("sends an error event and marks the ask failed when the search fails", async () => {
    const { d, asks } = deps(async () => {
      throw new Error("boom");
    });
    const events = await readEvents(await handleScout(post({ mode: "ask", ask: "pottery tonight", stream: true }), d));
    expect(events.map(([e]) => e)).toEqual(["understood", "error"]);
    expect(events[1][1]).toEqual({ error: "Something went wrong. Try again in a bit.", status: 500 });
    expect(asks).toEqual([{ id: 42, found: 0, added: 0, failed: true }]);
  });

  it("answers plainly, not as a stream, when it stops before searching (no ask left)", async () => {
    const search = vi.fn();
    const { d } = deps(search, { claimAsk: async () => null });
    const res = await handleScout(post({ mode: "ask", ask: "pottery tonight", stream: true }), d);
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(search).not.toHaveBeenCalled();
  });

  it("keeps working and saves the picks if the person stops (the ask still counts)", async () => {
    let release: () => void = () => undefined;
    const saved: unknown[] = [];
    const { d, asks } = deps(
      async () => {
        await new Promise<void>((r) => (release = r));
        return { text: picksText, sourceLinks: new Set([linkKey(PAGE)!]), searches: 1 };
      },
      { insertPersonal: async (row) => (saved.push(row), true) },
    );
    const res = await handleScout(post({ mode: "ask", ask: "pottery tonight", stream: true }), d);
    const reader = res.body!.getReader();
    await reader.read(); // understood
    await reader.cancel(); // Stop
    release();
    await vi.waitFor(() => expect(asks).toEqual([{ id: 42, found: 1, added: 1, failed: false }]));
    expect(saved).toHaveLength(1);
  });
});
