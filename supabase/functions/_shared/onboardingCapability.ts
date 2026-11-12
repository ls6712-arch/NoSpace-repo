/**
 * Stubby 3.0 Personal Capability Profile — pure, versioned domain contract.
 * Existing onboarding values are mapped in, not duplicated or silently overwritten.
 * This module does not persist data or make any network calls.
 */
export type CapabilitySource = "onboarding" | "user_edit" | "confirmed_profile";
export type CapabilityKind = "membership" | "subscription" | "discount" | "equipment" | "access";

export interface Capability {
  id: string;
  kind: CapabilityKind;
  label: string;
  /** User-entered; never interpreted as verified eligibility. */
  verification: "self_reported" | "verified";
  expiresAtUtc?: string;
}

export interface PersonalCapabilityProfileV1 {
  schemaVersion: 1;
  source: CapabilitySource;
  /** Existing 14 free-window keys, e.g. mon-eve. */
  freeWindows: string[];
  /** Existing monthly onboarding budget, distinct from per-outing budget. */
  monthlyBudget: number | null;
  /** Optional per-experience limit. A request-specific limit overrides it. */
  perActivityBudget: number | null;
  capabilities: Capability[];
  interests: string[];
  goals: string[];
  updatedAtUtc: string;
}

export interface CapabilityContext {
  freeWindows: readonly string[];
  budgetLimit: number | null;
  capabilities: readonly Capability[];
  interests: readonly string[];
  goals: readonly string[];
}

/** A user request overrides stored budget without modifying persistent memory. */
export function resolveCapabilityContext(
  profile: PersonalCapabilityProfileV1,
  request: { budgetLimit?: number | null } = {},
  nowUtc?: string,
): CapabilityContext {
  const budget = request.budgetLimit !== undefined ? request.budgetLimit : profile.perActivityBudget;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error("Invalid activity budget");
  }
  const now = nowUtc ? Date.parse(nowUtc) : Date.now();
  if (!Number.isFinite(now)) throw new Error("Invalid current time");
  return {
    freeWindows: [...profile.freeWindows],
    budgetLimit: budget,
    capabilities: profile.capabilities.filter((c) =>
      !c.expiresAtUtc || (Number.isFinite(Date.parse(c.expiresAtUtc)) && Date.parse(c.expiresAtUtc) > now)
    ),
    interests: [...profile.interests],
    goals: [...profile.goals],
  };
}

/** Bridge existing Soosh onboarding fields; no implicit membership verification. */
export function capabilityProfileFromTaste(input: {
  windows: readonly string[];
  monthlyBudget: number | null;
  passes: readonly { id: string; label: string; kind: string }[];
  picks: readonly string[];
  updatedAtUtc: string;
}): PersonalCapabilityProfileV1 {
  return {
    schemaVersion: 1,
    source: "confirmed_profile",
    freeWindows: [...input.windows],
    monthlyBudget: input.monthlyBudget,
    perActivityBudget: null,
    capabilities: input.passes.map((p) => ({
      id: p.id,
      kind: passCapabilityKind(p.kind),
      label: p.label,
      verification: "self_reported" as const,
    })),
    interests: [...input.picks],
    goals: [],
    updatedAtUtc: input.updatedAtUtc,
  };
}

/** One classification shared by the onboarding bridge and server context. */
export function passCapabilityKind(kind: string): CapabilityKind {
  return kind === "gear" || kind === "bike" ? "equipment" : "membership";
}
