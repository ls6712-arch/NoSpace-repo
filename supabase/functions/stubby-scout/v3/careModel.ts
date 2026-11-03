/**
 * The care step's model check (care.ts), with Claude: no tools, one short structured answer, a
 * tight time limit. The text goes to Anthropic for this one call and nowhere else: never logged,
 * never stored. Any failure is thrown, and careCheck then shows the card (err toward showing).
 */
import { API_URL, authHeaders } from "../search.ts";
import { boundedBody, object } from "./modelContract.ts";
import { CARE_MODEL_INSTRUCTIONS, CARE_SCHEMA, type CareLevel, type CareModel } from "./care.ts";

export function claudeCareModel(o: { apiKey: string; workspaceId?: string | null; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }): CareModel {
  return async (text: string): Promise<CareLevel> => {
    if (!o.apiKey.trim()) throw new Error("No key");
    const res = await (o.fetchImpl ?? fetch)(API_URL, {
      method: "POST",
      headers: authHeaders(o.apiKey, o.workspaceId),
      signal: AbortSignal.timeout(o.timeoutMs ?? 6000),
      body: JSON.stringify({
        model: o.model,
        max_tokens: 50,
        system: CARE_MODEL_INSTRUCTIONS,
        messages: [{ role: "user", content: JSON.stringify({ message: text.slice(0, 500) }) }],
        output_config: { format: { type: "json_schema", schema: CARE_SCHEMA } },
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error("Care check unavailable");
    }
    const data: unknown = JSON.parse(await boundedBody(res));
    if (!object(data) || data.stop_reason !== "end_turn" || !Array.isArray(data.content)) throw new Error("Invalid care answer");
    const out = data.content.map((b: unknown) => (object(b) && b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
    const level = (JSON.parse(out) as { level?: unknown }).level;
    if (level !== "distress" && level !== "low" && level !== "none") throw new Error("Invalid care answer");
    return level;
  };
}
