export * from "../../../supabase/functions/_shared/personalization";
/** Enable only after the additive personalization migration and compatible readers are deployed. */
export const humanOnboardingEnabled = import.meta.env.VITE_HUMAN_ONBOARDING === "true";
