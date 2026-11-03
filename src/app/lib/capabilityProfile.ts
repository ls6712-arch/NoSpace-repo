export { CAPABILITY_VERSION, emptyCapability, parseCapability, validTimeZone } from "../../../supabase/functions/_shared/capabilityProfile";
export type { CapabilityProfile, Membership, LearnedPreference } from "../../../supabase/functions/_shared/capabilityProfile";

/** Enable alongside the server V3 engine after test-project validation. */
export const stubbyV3Enabled = import.meta.env.VITE_STUBBY_V3 === "true";

// Preserve the branch's read-only onboarding contract alongside the consented extension.
export { capabilityProfileFromTaste, resolveCapabilityContext, passCapabilityKind } from "../../../supabase/functions/_shared/onboardingCapability";
export type { Capability, CapabilityKind, CapabilitySource, CapabilityContext, PersonalCapabilityProfileV1 } from "../../../supabase/functions/_shared/onboardingCapability";
