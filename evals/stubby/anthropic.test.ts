import { it, expect, vi } from "vitest";
import { anthropicAdapter, ANTHROPIC_URL, CLAUDE_MODEL } from "../../supabase/functions/stubby-scout/v3/anthropic.ts";
import { CANDIDATE_SCHEMA } from "../../supabase/functions/stubby-scout/v3/modelContract.ts";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { input } from "./fixtures.ts";
import { SOURCE_URL, providerRow, claudeResearch, claudeStructured, wireResponse } from "./provider-fixtures.ts";

function adapter(second: unknown = claudeStructured(), first: unknown = claudeResearch, maxSearches?: number) {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse(first)).mockResolvedValueOnce(wireResponse(second));
  return { ...anthropicAdapter({ apiKey: "server-test-key", workspaceId: "workspace-test", fetchImpl, maxSearches }), fetchImpl };
}
const discover = (a: ReturnType<typeof adapter>) => a.adapter.discover(buildContext(input()), "pottery", new AbortController().signal);

it("uses Claude billing, existing workspace headers, bounded search and structured extraction", async () => {
  const a = adapter(); const rows = await discover(a);
  expect(rows).toHaveLength(1); expect(rows[0].evidence[0]).toMatchObject({ source: "anthropic-web-v1", level: "search", url: SOURCE_URL });
  expect(a.usage).toEqual({ input: 200, output: 90, calls: 2 });
  const bodies = a.fetchImpl.mock.calls.map(([url, req]) => {
    expect(url).toBe(ANTHROPIC_URL);
    expect(req?.headers).toMatchObject({ authorization: "Bearer server-test-key", "anthropic-workspace-id": "workspace-test", "anthropic-version": "2023-06-01" });
    return JSON.parse(String(req?.body));
  });
  expect(bodies[0]).toMatchObject({ model: CLAUDE_MODEL, max_tokens: 2500, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }] });
  expect(bodies[1]).toMatchObject({ max_tokens: 4000, output_config: { format: { type: "json_schema", schema: CANDIDATE_SCHEMA } } });
  expect(bodies[1].tools).toBeUndefined();
  expect(JSON.stringify(bodies)).not.toContain("server-test-key");
  expect(a.fetchImpl.mock.calls[0][1]?.signal).toBe(a.fetchImpl.mock.calls[1][1]?.signal);
});
it("keeps private data out of hosted search while allowing tool-free personalization", async () => {
  const a = adapter(); const req = input({ capability: { ...input().capability, goals: ["private goal"], equipment: ["private gear"] } });
  await a.adapter.discover(buildContext(req), "pottery near secret-alice@example.org", new AbortController().signal);
  const bodies = a.fetchImpl.mock.calls.map(([, req]) => JSON.parse(String(req?.body)));
  expect(JSON.stringify(bodies[0])).not.toMatch(/private goal|private gear|secret-alice/);
  expect(JSON.stringify(bodies[1])).toContain("private goal");
  expect(bodies[1].tools).toBeUndefined();
});
it("a search citation remains partial evidence after the complete V3 pipeline", async () => {
  const a = adapter(); const r = await runV3(input(), { discovery: [a.adapter], usage: a.usage });
  expect(r.outcome).toBe("partial"); expect(r.recommendations).toHaveLength(1);
  expect(r.recommendations[0].candidate.evidence[0].source).toBe("anthropic-web-v1");
});
it("does not invent a source URL", async () => {
  const a = adapter(claudeStructured({ ...providerRow, url: "https://example.org/invented" }));
  expect(await discover(a)).toEqual([]);
});
it.each([
  { ...providerRow, starts: "2026-11-03T18:00:00" }, { ...providerRow, starts: "2026-02-30T18:00:00Z" },
  { ...providerRow, maxCostUsd: -1 }, { ...providerRow, equipment: "guitar" },
  { ...providerRow, execute: "buy" }, { ...providerRow, verification: "verified" },
])("rejects invalid Claude output %j", async bad => {
  const a = adapter(claudeStructured(bad)); await expect(discover(a)).rejects.toThrow();
});
it.each(["max_tokens", "pause_turn", "refusal", "tool_use", null])("refuses incomplete research: %s", async stop_reason => {
  const a = adapter(undefined, { ...claudeResearch, stop_reason });
  await expect(discover(a)).rejects.toThrow("Incomplete Claude response"); expect(a.fetchImpl).toHaveBeenCalledTimes(1);
});
it.each(["max_tokens", "pause_turn", "refusal", "tool_use"]) ("refuses incomplete extraction: %s", async stop_reason => {
  const a = adapter({ ...claudeStructured(), stop_reason }); await expect(discover(a)).rejects.toThrow("Incomplete Claude response");
});
it("never executes an unapproved tool in either phase", async () => {
  const tool = { type: "tool_use", name: "send_message", input: { text: "private" } };
  const a = adapter({ ...claudeStructured(), content: [tool] });
  await expect(discover(a)).rejects.toThrow("Unauthorized extraction"); expect(a.fetchImpl).toHaveBeenCalledTimes(2);
  const b = adapter(undefined, { ...claudeResearch, content: [tool] });
  await expect(discover(b)).rejects.toThrow("Unauthorized tool"); expect(b.fetchImpl).toHaveBeenCalledTimes(1);
});
it("returns no candidates and skips extraction when there is no source", async () => {
  const a = adapter(undefined, { type: "message", stop_reason: "end_turn", content: [{ type: "text", text: "Nothing found" }] });
  expect(await discover(a)).toEqual([]); expect(a.fetchImpl).toHaveBeenCalledTimes(1);
});
it("recognizes citation-only provenance", async () => {
  const a = adapter(undefined, { ...claudeResearch, content: [claudeResearch.content[2]] });
  expect(await discover(a)).toHaveLength(1);
});
it("fails honestly when the hosted search returns an error", async () => {
  const a = adapter(undefined, { ...claudeResearch, content: [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } }] });
  await expect(discover(a)).rejects.toThrow("Claude search unavailable"); expect(a.fetchImpl).toHaveBeenCalledTimes(1);
});
it("honors a one-search cap and rejects an excessive hosted-tool count", async () => {
  const a = adapter(undefined, undefined, 1); await discover(a);
  expect(JSON.parse(String(a.fetchImpl.mock.calls[0][1]?.body)).tools[0].max_uses).toBe(1);
  const b = adapter(undefined, { ...claudeResearch, content: [...claudeResearch.content, claudeResearch.content[0]] }, 1);
  await expect(discover(b)).rejects.toThrow("Search cap exceeded"); expect(b.fetchImpl).toHaveBeenCalledTimes(1);
});
it.each([401, 402, 403, 400])("does not retry account/credit errors or leak provider bodies: %s", async status => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(wireResponse({ error: "sensitive account details" }, status));
  const a = anthropicAdapter({ apiKey: "test", fetchImpl });
  await expect(a.adapter.discover(buildContext(input()), "pottery", new AbortController().signal)).rejects.toThrow("Claude unavailable");
  expect(fetchImpl).toHaveBeenCalledTimes(1); expect(fetchImpl.mock.calls[0][0]).toBe(ANTHROPIC_URL);
});
it("retries transient errors once within the shared three-call budget", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse({}, 429)).mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse(claudeStructured()));
  const a = anthropicAdapter({ apiKey: "test", fetchImpl });
  expect(await a.adapter.discover(buildContext(input()), "pottery", new AbortController().signal)).toHaveLength(1);
  expect(a.usage.calls).toBe(3);
});
it("does not retry both phases beyond the total call budget", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse({}, 503)).mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse({}, 503));
  const a = anthropicAdapter({ apiKey: "test", fetchImpl });
  await expect(a.adapter.discover(buildContext(input()), "pottery", new AbortController().signal)).rejects.toThrow("Claude unavailable");
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});
it("includes cached input usage without changing quota behavior", async () => {
  const a = adapter(undefined, { ...claudeResearch, usage: { input_tokens: 100, output_tokens: 40, cache_creation_input_tokens: 12, cache_read_input_tokens: 20 } });
  await discover(a); expect(a.usage.input).toBe(232);
});
it("rejects oversized responses and malformed JSON", async () => {
  for (const body of ["x".repeat(200001), "not JSON"]) {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const a = anthropicAdapter({ apiKey: "test", fetchImpl });
    await expect(a.adapter.discover(buildContext(input()), "pottery", new AbortController().signal)).rejects.toThrow();
  }
});
it("aborts before spending a call when the deadline has already elapsed", async () => {
  const fetchImpl = vi.fn<typeof fetch>(); const a = anthropicAdapter({ apiKey: "test", fetchImpl });
  const controller = new AbortController(); controller.abort();
  await expect(a.adapter.discover(buildContext(input()), "pottery", controller.signal)).rejects.toThrow();
  expect(fetchImpl).not.toHaveBeenCalled(); expect(a.usage.calls).toBe(0);
});
