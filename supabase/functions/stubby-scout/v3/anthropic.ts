/** Claude Messages adapter. Reuses the existing API/workspace bindings and account billing. */
import { API_URL, authHeaders } from "../search.ts";
import { safeSourceUrl } from "./evidence.ts";
import { object, boundedBody, tokenCount, searchCap, RESEARCH_INSTRUCTIONS, EXTRACTION_INSTRUCTIONS,
  researchInput, extractionInput, candidatesFrom, CANDIDATE_SCHEMA, type Json } from "./modelContract.ts";
import type { Context, DiscoveryAdapter } from "./types.ts";

export const ANTHROPIC_URL = API_URL;
export const CLAUDE_MODEL = "claude-haiku-5-5";

function contentOf(data: Json): Json[] {
  if (data.type !== "message" || !Array.isArray(data.content) || data.content.some(x => !object(x))) throw new Error("Invalid Claude response");
  return data.content as Json[];
}
function researchOf(blocks: Json[], limit: number) {
  const urls = new Set<string>();
  const text: string[] = [];
  let searches = 0;
  for (const b of blocks) {
    if (b.type === "tool_use" || b.type === "server_tool_use" && b.name !== "web_search") throw new Error("Unauthorized tool response");
    if (b.type === "server_tool_use") searches++;
    if (b.type === "web_search_tool_result") {
      if (!Array.isArray(b.content)) throw new Error("Claude search unavailable");
      for (const source of b.content) {
        if (!object(source)) throw new Error("Invalid search result");
        if (source.type === "web_search_tool_result_error") throw new Error("Claude search unavailable");
        if (source.type !== "web_search_result") continue;
        const url = safeSourceUrl(source.url); if (url) urls.add(url);
      }
    }
    if (b.type === "text" && typeof b.text === "string") {
      text.push(b.text);
      if (Array.isArray(b.citations)) for (const c of b.citations) {
        if (object(c) && c.type === "web_search_result_location") { const url = safeSourceUrl(c.url); if (url) urls.add(url); }
      }
    }
  }
  if (searches > limit) throw new Error("Search cap exceeded");
  return { urls, text: text.join("\n") };
}

export function anthropicAdapter(options: { apiKey: string; workspaceId?: string | null; model?: string; fetchImpl?: typeof fetch; maxSearches?: number }) {
  const usage = { input: 0, output: 0, calls: 0 };
  const request = async (body: Json, signal: AbortSignal): Promise<Json[]> => {
    for (let attempt = 0; attempt < 2 && usage.calls < 3; attempt++) {
      signal.throwIfAborted();
      usage.calls++;
      const res = await (options.fetchImpl ?? fetch)(ANTHROPIC_URL, {
        method: "POST", signal, headers: authHeaders(options.apiKey, options.workspaceId),
        body: JSON.stringify({ model: options.model || CLAUDE_MODEL, ...body }),
      });
      if (!res.ok) {
        await res.body?.cancel();
        if ((res.status === 429 || res.status >= 500) && attempt === 0 && usage.calls < 3) continue;
        // Never expose upstream bodies or fall back to another billable provider.
        throw new Error("Claude unavailable");
      }
      const data: unknown = JSON.parse(await boundedBody(res));
      if (!object(data)) throw new Error("Invalid Claude response");
      if (object(data.usage)) {
        usage.input += tokenCount(data.usage.input_tokens) + tokenCount(data.usage.cache_creation_input_tokens) + tokenCount(data.usage.cache_read_input_tokens);
        usage.output += tokenCount(data.usage.output_tokens);
      }
      // No continuations: truncation, refusal, pause_turn and tool requests fail honestly.
      if (data.stop_reason !== "end_turn") throw new Error("Incomplete Claude response");
      return contentOf(data);
    }
    throw new Error("Call budget exceeded");
  };
  const adapter: DiscoveryAdapter = {
    id: "anthropic-web-v1",
    async discover(ctx: Context, query, signal) {
      if (!options.apiKey.trim()) throw new Error("Missing Anthropic key");
      const limit = searchCap(options.maxSearches);
      const research = researchOf(await request({
        system: RESEARCH_INSTRUCTIONS,
        messages: [{ role: "user", content: JSON.stringify(researchInput(ctx)) }],
        max_tokens: 2500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: limit,
          ...(ctx.city ? { user_location: { type: "approximate", city: ctx.city, timezone: ctx.timeZone } } : {}) }],
      }, signal), limit);
      if (!research.urls.size) return [];
      const structured = await request({
        system: EXTRACTION_INSTRUCTIONS,
        messages: [{ role: "user", content: JSON.stringify(extractionInput(ctx, query, research.urls, research.text)) }],
        max_tokens: 4000,
        output_config: { format: { type: "json_schema", schema: CANDIDATE_SCHEMA } },
      }, signal);
      // This phase has no tools. A returned tool call is rejected, never executed.
      if (structured.some(b => b.type !== "text")) throw new Error("Unauthorized extraction output");
      const text = structured.map(b => typeof b.text === "string" ? b.text : "").join("\n");
      return candidatesFrom(JSON.parse(text), research.urls, ctx, "anthropic-web-v1");
    },
  };
  return { adapter, usage };
}
