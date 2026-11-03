import type { Candidate } from "./types.ts";
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
export function assessEvidence(c: Candidate, now: number): { verified: boolean; warnings: string[] } | null {
  if (!c.evidence.length || c.evidence.some(e => !safeSourceUrl(e.url) || !Number.isFinite(e.checkedAt) || e.checkedAt > now || now - e.checkedAt > 24 * 3600000)) return null;
  const verified = c.evidence.every(e => e.level === "provider") && c.status === "scheduled" && c.availability === "available" && c.endsAt !== null && c.cost !== null;
  const warnings: string[] = [];
  if (!verified) warnings.push("Source details need confirmation before you go.");
  if (!c.cost) warnings.push("Price is unknown.");
  if (!c.endsAt) warnings.push("End time is unknown.");
  if (c.availability === "unknown") warnings.push("Availability is unknown.");
  return { verified, warnings };
}
