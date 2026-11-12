/** V1 private memory contract. Shared by the editor and Edge Function. No SDK or browser APIs. */
export const CAPABILITY_VERSION = 1 as const;
export interface Membership {
  name: string;
  expiresOn: string | null;
  /** Self-report is never proof of admission or a discount. */
  status: "self_reported";
}
export interface LearnedPreference {
  source: "feedback";
  reason?: "price"|"time"|"distance"|"activity"|"today"|null;
  scope?: "request"|"usual";
  title: string;
  signal: "up" | "down" | "save";
}
export interface CapabilityProfile {
  version: 1;
  consent: { memory: boolean; onboarding: boolean; feedback: boolean };
  timeZone: string;
  perActivityBudget: number | null;
  equipment: string[];
  goals: string[];
  preferences: string[];
  memberships: Membership[];
}
export function emptyCapability(): CapabilityProfile {
  return { version: 1, consent: { memory: false, onboarding: false, feedback: false }, timeZone: "America/New_York", perActivityBudget: null, equipment: [], goals: [], preferences: [], memberships: [] };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function validTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 80) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
}
const lines = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.length > 20 || v.some(x => typeof x !== "string" || x.length > 120 || /[\u0000-\u001f<>]/.test(x))) throw new Error("Use up to 20 short entries.");
  return [...new Set(v.map(x => (x as string).trim()).filter(Boolean))];
};
/** Strict on writes and provider boundaries. An invalid read must fail closed, never grant consent. */
export function parseCapability(v: unknown): CapabilityProfile {
  if (!object(v) || v.version !== 1 || !object(v.consent)) throw new Error("This saved profile cannot be read. Try again.");
  const allowed = ["version", "consent", "timeZone", "perActivityBudget", "equipment", "goals", "preferences", "memberships"];
  if (Object.keys(v).some(k => !allowed.includes(k)) || Object.keys(v.consent).some(k => !["memory", "onboarding", "feedback"].includes(k))) throw new Error("Unknown profile field.");
  for (const k of ["memory", "onboarding", "feedback"]) if (typeof v.consent[k] !== "boolean") throw new Error("Choose what Stubby can remember.");
  if (!validTimeZone(v.timeZone)) throw new Error("Enter a valid timezone, such as America/New_York.");
  if (v.perActivityBudget !== null && (typeof v.perActivityBudget !== "number" || !Number.isFinite(v.perActivityBudget) || v.perActivityBudget < 0 || v.perActivityBudget > 10000)) throw new Error("Enter an activity budget from 0 to 10000.");
  if (!Array.isArray(v.memberships) || v.memberships.length > 20) throw new Error("Use up to 20 memberships.");
  const memberships = v.memberships.map(m => {
    if (!object(m) || m.status !== "self_reported" || Object.keys(m).some(k => !["name", "expiresOn", "status"].includes(k))) throw new Error("Memberships are self-reported.");
    const name = lines([m.name])[0];
    if (!name || (m.expiresOn !== null && (typeof m.expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.expiresOn) || new Date(`${m.expiresOn}T00:00:00Z`).toISOString().slice(0, 10) !== m.expiresOn))) throw new Error("Check the membership name and expiry date.");
    return { name, expiresOn: m.expiresOn as string | null, status: "self_reported" as const };
  });
  return { version: 1, consent: { memory: v.consent.memory as boolean, onboarding: v.consent.onboarding as boolean, feedback: v.consent.feedback as boolean }, timeZone: v.timeZone, perActivityBudget: v.perActivityBudget as number | null, equipment: lines(v.equipment), goals: lines(v.goals), preferences: lines(v.preferences), memberships };
}
