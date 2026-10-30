import { OnboardingFlow } from "./onboarding/OnboardingFlow";

/** /onboarding: the Soosh flow with Stubby. It is the only way to make an account, and it asks for a birthday. */
export function Onboarding() {
  return <OnboardingFlow />;
}
