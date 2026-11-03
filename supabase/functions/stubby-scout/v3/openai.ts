/** Optional OpenAI Responses adapter; selection is explicit and server-side. */
import { safeSourceUrl } from "./evidence.ts";
import type { DiscoveryAdapter, Context } from "./types.ts";
import { object, boundedBody, tokenCount, searchCap, RESEARCH_INSTRUCTIONS, EXTRACTION_INSTRUCTIONS,
  researchInput, extractionInput, candidatesFrom, CANDIDATE_SCHEMA as RESPONSE_SCHEMA, type Json } from "./modelContract.ts";
export { CANDIDATE_SCHEMA as RESPONSE_SCHEMA, PROMPT_VERSION } from "./modelContract.ts";
export const OPENAI_URL = "https://api.openai.com/v1/responses";
export const OPENAI_MODEL = "gpt-4.1";
function outputText(body: Json): string {
  if (!Array.isArray(body.output)) throw new Error("Invalid response");
  return body.output.filter(object).flatMap(x => Array.isArray(x.content) ? x.content.filter(object) : []).filter(x => x.type === "output_text" && typeof x.text === "string").map(x => x.text).join("\n");
}
function sourceUrls(body: Json): Set<string> {
  const urls = new Set<string>();
  for (const item of Array.isArray(body.output) ? body.output.filter(object) : []) {
    if (item.type === "web_search_call" && object(item.action) && Array.isArray(item.action.sources)) {
      for (const s of item.action.sources.filter(object)) { const u = safeSourceUrl(s.url); if (u) urls.add(u); }
    }
    for (const c of Array.isArray(item.content) ? item.content.filter(object) : []) {
      for (const a of Array.isArray(c.annotations) ? c.annotations.filter(object) : []) {
        if (a.type === "url_citation") { const u = safeSourceUrl(a.url); if (u) urls.add(u); }
      }
    }
  }
  return urls;
}
export function openAIAdapter(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch; maxSearches?: number }) {
  const usage = { input: 0, output: 0, calls: 0 };
  const request = async (body: Json, signal: AbortSignal): Promise<Json> => {
    // A third call is the total retry budget across both phases, never an unbounded agent loop.
    for (let attempt = 0; attempt < 2 && usage.calls < 3; attempt++) {
      usage.calls++;
      const res = await (options.fetchImpl ?? fetch)(OPENAI_URL, {
        method: "POST", signal, headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: options.model ?? OPENAI_MODEL, store: false, ...body }),
      });
      if (!res.ok) {
        await res.body?.cancel();
        if ((res.status === 429 || res.status >= 500) && attempt === 0 && usage.calls < 3) continue;
        throw new Error("OpenAI unavailable");
      }
      const raw = await boundedBody(res);
      const data: unknown = JSON.parse(raw);
      if (!object(data) || data.status !== "completed") throw new Error("Incomplete response");
      if (object(data.usage)) {
        usage.input += tokenCount(data.usage.input_tokens);
        usage.output += tokenCount(data.usage.output_tokens);
      }
      return data;
    }
    throw new Error("Call budget exceeded");
  };
  const adapter: DiscoveryAdapter = {
    id: "openai-web-v1",
    async discover(ctx: Context, query, signal) {
      if (!options.apiKey) throw new Error("Missing OpenAI key");
      const research = await request({
        instructions: RESEARCH_INSTRUCTIONS,
        input: JSON.stringify(researchInput(ctx)),
        tools: [{ type: "web_search", search_context_size: "low", ...(ctx.city ? { user_location: { type: "approximate", city: ctx.city, timezone: ctx.timeZone } } : {}) }],
        max_tool_calls: searchCap(options.maxSearches), max_output_tokens: 2500, include: ["web_search_call.action.sources"],
      }, signal);
      const urls = sourceUrls(research);
      if (!urls.size) return [];
      const structured = await request({
        instructions: EXTRACTION_INSTRUCTIONS,
        input: JSON.stringify(extractionInput(ctx, query, urls, outputText(research))),
        max_output_tokens: 4000,
        text: { format: { type: "json_schema", name: "stubby_candidates_v1", strict: true, schema: RESPONSE_SCHEMA } },
      }, signal);
      return candidatesFrom(JSON.parse(outputText(structured)), urls, ctx, "openai-web-v1");
    },
  };
  return { adapter, usage };
}
