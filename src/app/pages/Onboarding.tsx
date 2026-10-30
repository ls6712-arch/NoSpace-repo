import { sooshOnboardingEnabled } from "../config";
import { OnboardingFlow } from "./onboarding/OnboardingFlow";
import { OnboardingLegacy } from "./OnboardingLegacy";

export { joinTokenFrom } from "./OnboardingLegacy";

/** /onboarding: the Soosh flow with Stubby, or the old two steps until it is switched on. */
export function Onboarding() {
  return sooshOnboardingEnabled ? <OnboardingFlow /> : <OnboardingLegacy />;
}
