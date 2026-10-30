import type { StubbyState } from "../../components/stubby/Stubby";

/**
 * The twelve onboarding screens, in order (Soosh onboarding brief, section 2).
 * The key is what the URL carries (`?step=name`) and what progress saves.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "signup",
  "code",
  "name",
  "birthday",
  "where",
  "picks",
  "free",
  "yours",
  "card",
  "plan",
  "invite",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const isStep = (value: string | null | undefined): value is OnboardingStep =>
  !!value && (ONBOARDING_STEPS as readonly string[]).includes(value);

export const stepIndex = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step);

/** Before there is an account. A signed-in person never sees these. */
const PRE_AUTH: readonly OnboardingStep[] = ["welcome", "signup", "code"];
const LAST_PRE_AUTH: OnboardingStep = "code";
export const isPreAuth = (step: OnboardingStep) => PRE_AUTH.includes(step);

/** The three taste questions that carry the "1 of 3" header and share one Stubby. */
export const COUNTED_STEPS: readonly OnboardingStep[] = ["picks", "free", "yours"];
export const isCounted = (step: OnboardingStep) => COUNTED_STEPS.includes(step);

/** Where the page behind the 430px column sits: cobalt, platform grey or navy. */
export type Tone = "cobalt" | "platform" | "navy";
export const STEP_TONE: Record<OnboardingStep, Tone> = {
  welcome: "cobalt",
  signup: "platform",
  code: "platform",
  name: "platform",
  birthday: "platform",
  where: "platform",
  picks: "platform",
  free: "platform",
  yours: "platform",
  card: "navy",
  plan: "navy",
  invite: "platform",
};

/** Stubby's resting state when a screen opens. Screens react from there. */
export const STEP_STUBBY: Record<OnboardingStep, StubbyState> = {
  welcome: "cool",
  signup: "idle",
  code: "idle",
  name: "idle",
  birthday: "idle",
  where: "idle",
  picks: "idle",
  free: "idle",
  yours: "idle",
  card: "cool",
  plan: "thinking",
  invite: "idle",
};

export const nextStep = (step: OnboardingStep): OnboardingStep | null => ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
export const prevStep = (step: OnboardingStep): OnboardingStep | null => ONBOARDING_STEPS[stepIndex(step) - 1] ?? null;

/** Back is on every step except the first and the plan (the plan is the payoff, not a form). */
export function backTarget(step: OnboardingStep, signedIn: boolean): OnboardingStep | null {
  if (step === "welcome" || step === "plan") return null;
  const prev = prevStep(step);
  if (!prev) return null;
  // An account exists once the code is accepted; there is no screen to go back to.
  if (signedIn && isPreAuth(prev)) return null;
  return prev;
}

/**
 * Which screen to show. A URL can ask for any step, but never one past the
 * next unfinished step (so a typed URL cannot skip a required question), and
 * a signed-in person never lands on the pre-account screens. Someone with no
 * account yet can walk the pre-account screens and nothing past them.
 *
 * `open` is for a build with no accounts at all (no Supabase project, so
 * nothing to protect): every screen can be opened, which is how the flow is
 * reviewed locally.
 */
export function resolveStep(
  requested: string | null | undefined,
  lastFinished: OnboardingStep | null,
  signedIn: boolean,
  open = false,
): OnboardingStep {
  if (open) return isStep(requested) ? requested : "welcome";
  const floor: OnboardingStep = signedIn ? "name" : "welcome";
  const resume = lastFinished ? (nextStep(lastFinished) ?? lastFinished) : floor;
  const reach = signedIn ? (stepIndex(resume) < stepIndex(floor) ? floor : resume) : LAST_PRE_AUTH;
  const wanted = isStep(requested) ? requested : signedIn ? reach : floor;
  const clamped = stepIndex(wanted) > stepIndex(reach) ? reach : wanted;
  return stepIndex(clamped) < stepIndex(floor) ? floor : clamped;
}

/** +1 when moving forward, -1 when moving back, 0 for the first screen. */
export const slideDirection = (from: OnboardingStep | null, to: OnboardingStep): -1 | 0 | 1 =>
  from === null || from === to ? 0 : stepIndex(to) > stepIndex(from) ? 1 : -1;
