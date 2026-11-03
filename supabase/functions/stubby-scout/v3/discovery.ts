import { safeSourceUrl } from "./evidence.ts";
import type { Candidate, Context, DiscoveryAdapter } from "./types.ts";
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const short = (x: unknown, max: number): x is string => typeof x === "string" && x.length > 0 && x.length <= max && !/[\u0000-\u001f<>]/.test(x);
/** Runtime boundary for every adapter, including test adapters. Facts with invalid fields never enter the index. */
export function validCandidate(v: unknown): v is Candidate {
  if (!obj(v) || !short(v.id, 100) || !short(v.title, 80) || !["event", "idea"].includes(v.kind as string)) return false;
  if (!finite(v.startsAt) || !(v.endsAt === null || finite(v.endsAt))) return false;
  if (!["home", "indoor", "outdoor", "unknown"].includes(v.setting as string) || !["scheduled", "cancelled", "unknown"].includes(v.status as string) || !["available", "sold_out", "unknown"].includes(v.availability as string)) return false;
  if (![v.city, v.place, v.membership].every(x => x === null || short(x, 80))) return false;
  if (!(v.minAge === null || (finite(v.minAge) && Number.isInteger(v.minAge) && v.minAge <= 100)) || !(v.travelMinutes === null || (finite(v.travelMinutes) && v.travelMinutes <= 1440))) return false;
  if (!(v.cost === null || (obj(v.cost) && finite(v.cost.max) && v.cost.max <= 100000 && v.cost.currency === "USD"))) return false;
  if (![v.equipment, v.tags].every(a => Array.isArray(a) && a.length <= 20 && a.every(x => short(x, 80)))) return false;
  if (!Array.isArray(v.evidence) || v.evidence.length === 0 || v.evidence.length > 10) return false;
  return v.evidence.every(e => obj(e) && !!safeSourceUrl(e.url) && finite(e.checkedAt) && ["provider", "search"].includes(e.level as string) && short(e.source, 80));
}
/** Ingestion -> normalization -> deduplication -> classification -> verification -> in-memory index. */
export async function discover(adapters: DiscoveryAdapter[], ctx: Context, query: string, signal: AbortSignal) {
  const candidates: Candidate[] = [];
  const warnings: string[] = [];
  for (const a of adapters.slice(0, 3)) {
    if (signal.aborted) { warnings.push("Discovery timed out."); break; }
    try {
      const rows = await a.discover(ctx, query, signal);
      if (!Array.isArray(rows) || rows.length > 100) throw new Error("Invalid provider result");
      for (const row of rows) {
        if (!validCandidate(row)) { warnings.push("A source returned invalid details."); continue; }
        candidates.push(row);
      }
    } catch { warnings.push(`Source unavailable: ${a.id}.`); }
  }
  return { candidates, warnings: [...new Set(warnings)] };
}
