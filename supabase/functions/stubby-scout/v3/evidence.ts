import type { Candidate, Evidence } from "./types.ts";
/** Navigation only. Reject credentials, local/private address literals, odd ports and unsafe schemes. */
export function safeSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
    if (u.hostname.endsWith(".") || !u.hostname.includes(".") || u.hostname.includes(":") || /^(\d+\.){3}\d+$/.test(u.hostname) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)) return null;
    u.hash = "";
    return u.href;
  } catch { return null; }
}
/** The person's own Pursuit or a Corner's start page: the only paths the database lets an idea link to (personal_picks_url_check). */
export const SOOSH_PATH = /^\/(start|pursuit)\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?$/;
export const SOOSH_SOURCE = "soosh-db";
/** A Soosh page is evidence only when Soosh's own database put it there, never a model. */
export const sooshEvidence = (e: Pick<Evidence, "url" | "source" | "level">) => e.source === SOOSH_SOURCE && e.level === "provider" && SOOSH_PATH.test(e.url);
export const isSoosh = (c: Pick<Candidate, "evidence">) => c.evidence.length > 0 && c.evidence.every(sooshEvidence);
export function assessEvidence(c: Candidate, now: number): { verified: boolean; warnings: string[] } | null {
  if (!c.evidence.length || c.evidence.some(e => !(safeSourceUrl(e.url) || sooshEvidence(e)) || !Number.isFinite(e.checkedAt) || e.checkedAt > now || now - e.checkedAt > 24 * 3600000)) return null;
  // Their own Pursuit or Corner: nothing to confirm with a source. What it needs is said instead (needs).
  if (isSoosh(c)) return { verified: true, warnings: [] };
  const place = c.kind === "place";
  const verified = c.evidence.every(e => e.level === "provider") && c.status === "scheduled" && c.availability === "available" && (place || c.endsAt !== null) && c.cost !== null;
  const warnings: string[] = [];
  if (!verified) warnings.push("Source details need confirmation before you go.");
  if (!c.cost) warnings.push("Price is unknown.");
  if (!c.endsAt && !place) warnings.push("End time is unknown.");
  if (place) warnings.push("Check opening hours before you go.");
  else if (c.availability === "unknown") warnings.push("Availability is unknown.");
  return { verified, warnings };
}
