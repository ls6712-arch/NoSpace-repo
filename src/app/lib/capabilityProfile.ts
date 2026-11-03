export { CAPABILITY_VERSION, emptyCapability, parseCapability, validTimeZone } from "../../../supabase/functions/_shared/capabilityProfile";
export type { CapabilityProfile, Membership, LearnedPreference } from "../../../supabase/functions/_shared/capabilityProfile";

/** Enable alongside the server V3 engine after test-project validation. */
export const stubbyV3Enabled = import.meta.env.VITE_STUBBY_V3 === "true";
