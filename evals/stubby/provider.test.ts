import { it, expect, vi } from "vitest";
import { createV3Provider, providerHasKey } from "../../supabase/functions/stubby-scout/v3/provider.ts";
import { readSettings } from "../../supabase/functions/stubby-scout/handler.ts";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { input } from "./fixtures.ts";
import { claudeResearch, claudeStructured, wireResponse } from "./provider-fixtures.ts";
const env = (values: Record<string, string>) => (key: string) => values[key];
it("uses Claude with the existing Anthropic key, and nothing else (Nov 3, 2026)", () => {
  const read = env({ STUBBY_V3_TESTERS: "u1", ANTHROPIC_API_KEY: "test" });
  expect(providerHasKey(read)).toBe(true);
  expect(readSettings(read)).toMatchObject({ askHasKey: true, hasKey: true });
  expect(createV3Provider(read).adapter.id).toBe("anthropic-web-v1");
  expect(providerHasKey(env({ OPENAI_API_KEY: "test" }))).toBe(false);
  expect(providerHasKey(env({ ANTHROPIC_API_KEY: "   " }))).toBe(false);
});
it("reuses the configured Claude model and workspace with no provider failover", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse(claudeStructured()));
  const selected = createV3Provider(env({ ANTHROPIC_API_KEY: "claude-test", OPENAI_API_KEY: "unused", ANTHROPIC_WORKSPACE_ID: "existing-workspace", STUBBY_SCOUT_MODEL: "existing-claude-model" }), { fetchImpl });
  await selected.adapter.discover(buildContext(input()), "pottery", new AbortController().signal);
  for (const [url, req] of fetchImpl.mock.calls) {
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(String(req?.body)).model).toBe("existing-claude-model");
    expect(req?.headers).toMatchObject({ "anthropic-workspace-id": "existing-workspace" });
  }
});
it("allows a separate V3 model without changing legacy admin/restock selection", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse(claudeStructured()));
  const selected = createV3Provider(env({ ANTHROPIC_API_KEY: "test", STUBBY_CLAUDE_MODEL: "v3-claude-model", STUBBY_SCOUT_MODEL: "legacy-model" }), { fetchImpl });
  await selected.adapter.discover(buildContext(input()), "pottery", new AbortController().signal);
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).model).toBe("v3-claude-model");
});
