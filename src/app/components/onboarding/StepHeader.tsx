import { ArrowLeft } from "lucide-react";
import { COUNTED_STEPS, type OnboardingStep } from "../../pages/onboarding/steps";

/**
 * The header on the three taste questions: a back button, three bars and
 * "1 of 3". It counts this form's own steps and nothing else; no levels.
 */
export function StepHeader({ step, onBack }: { step: OnboardingStep; onBack: (() => void) | null }) {
  const total = COUNTED_STEPS.length;
  const position = COUNTED_STEPS.indexOf(step) + 1;
  if (position === 0) return null;
  return (
    <header className="flex items-center gap-3 pt-4">
      {onBack ? (
        <button type="button" className="ob-icon-button -ml-2" aria-label="Back" onClick={onBack}>
          <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : (
        <span className="size-11" aria-hidden="true" />
      )}
      <div className="flex gap-1.5" aria-hidden="true">
        {COUNTED_STEPS.map((s, i) => (
          <span key={s} className="ob-bar" data-filled={i < position} />
        ))}
      </div>
      <p className="ob-label ml-auto text-small ob-muted">{`${position} of ${total}`}</p>
    </header>
  );
}
