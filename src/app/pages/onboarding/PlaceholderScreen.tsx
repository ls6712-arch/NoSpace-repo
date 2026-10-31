import { PillButton } from "../../components/ui/PillButton";
import { useOnboarding } from "./OnboardingContext";
import { StepStubby } from "./StepStubby";
import { isCounted, type OnboardingStep } from "./steps";

/**
 * The screens ship in the next three PRs. Until then each one is this: its
 * headline (from the brief, where it gives one) and a button to the next.
 * Nothing here asks for or saves anything.
 */
const HEADLINE: Record<OnboardingStep, string> = {
  welcome: "Stop saying you’ll do it.",
  signup: "Sign up",
  code: "Code",
  name: "Name",
  birthday: "Birthday",
  where: "Where",
  picks: "What would you say yes to?",
  free: "When are you usually free?",
  yours: "What’s already yours?",
  card: "Put a face on your card",
  plan: "Tonight’s yours.",
  invite: "Who gets the other half?",
};

export function PlaceholderScreen() {
  const { step, next, finishing, finishError } = useOnboarding();
  const hero = step === "welcome";
  return (
    <section className="flex flex-1 flex-col pb-6">
      {/* The three taste screens share one Stubby that the flow keeps mounted. */}
      {!isCounted(step) && (
        <div className={hero ? "flex flex-1 items-center justify-center pt-12" : "flex justify-center pt-12"}>
          <StepStubby size={hero ? 260 : 140} followPointer={hero} />
        </div>
      )}
      <h1 className="mt-8 text-title">{HEADLINE[step]}</h1>
      <div className="mt-auto flex flex-col gap-3 pt-8">
        {finishError && (
          <p role="alert" className="text-small">
            {finishError}
          </p>
        )}
        <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => next()} disabled={finishing}>
          {step === "welcome" ? "Get started" : "Next"}
        </PillButton>
      </div>
    </section>
  );
}
