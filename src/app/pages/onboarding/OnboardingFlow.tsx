import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { StepHeader } from "../../components/onboarding/StepHeader";
import type { StubbyState } from "../../components/stubby/Stubby";
import { useAuth } from "../../context/AuthContext";
import { clearLastFinished, readLastFinished, writeLastFinished } from "../../lib/onboardingProgress";
import { PAGE_FROM, page } from "../../lib/motionTokens";
import { ERROR_LINE, OFFLINE_LINE } from "../../lib/stateCopy";
import { OnboardingContext, type OnboardingApi } from "./OnboardingContext";
import { PlaceholderScreen } from "./PlaceholderScreen";
import { StepStubby } from "./StepStubby";
import { STEP_STUBBY, STEP_TONE, backTarget, isCounted, nextStep, resolveStep, slideDirection, type OnboardingStep } from "./steps";

/** Between steps the old screen slides 24px away and the new one comes in from the other side. */
const SLIDE = 24;
const slide: Variants = {
  enter: (dir: number) => (dir === 0 ? PAGE_FROM : { opacity: 0, x: dir * SLIDE }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * SLIDE }),
};

/** How long a one-shot reaction is held before Stubby goes back to idle, so the same reaction can play again. */
const REACTION_HOLD_MS = 150;

/**
 * The onboarding step router (Soosh onboarding brief, section 2). The step
 * lives in the URL (`?step=name`), so the browser and Android back buttons
 * and swipe-back walk the screens. Each Next saves the last finished step, and
 * reopening the app resumes after it.
 *
 * Arriving from an invite link keeps `?redirect=` through every step.
 */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, updateProfile, isConfigured } = useAuth();
  const userId = user?.id;
  const signedIn = !!user;
  const redirectTo = params.get("redirect") || "/discover";

  const step = resolveStep(params.get("step"), readLastFinished(userId), signedIn, !isConfigured);
  const hrefFor = useCallback((s: OnboardingStep) => `/onboarding?step=${s}&redirect=${encodeURIComponent(redirectTo)}`, [redirectTo]);

  // A missing or out-of-reach ?step= is replaced with the screen the person should be on.
  useEffect(() => {
    if (params.get("step") !== step) navigate(hrefFor(step), { replace: true, state: { n: 0 } });
  }, [params, step, navigate, hrefFor]);

  // Direction for the slide: read before the ref moves on to the new step.
  const shownBefore = useRef<OnboardingStep | null>(null);
  const dir = slideDirection(shownBefore.current, step);
  useEffect(() => {
    shownBefore.current = step;
  }, [step]);

  // How many steps this visit has pushed, so Back can use history when it can.
  const pushed = (location.state as { n?: number } | null)?.n ?? 0;

  // Stubby's state is the step's own unless a screen has set one for this step.
  // Deriving it (rather than resetting in an effect) means a new screen's
  // Stubby never mounts for one frame in the last screen's state.
  const [override, setOverride] = useState<{ step: OnboardingStep; state: StubbyState } | null>(null);
  const stubby = override?.step === step ? override.state : STEP_STUBBY[step];
  const stepNow = useRef(step);
  stepNow.current = step;
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const setStubby = useCallback((state: StubbyState) => {
    clearTimeout(holdTimer.current);
    setOverride({ step: stepNow.current, state });
  }, []);
  const react = useCallback((state: StubbyState) => {
    clearTimeout(holdTimer.current);
    const at = stepNow.current;
    setOverride({ step: at, state });
    holdTimer.current = setTimeout(() => setOverride((o) => (o?.step === at ? { step: at, state: "idle" } : o)), REACTION_HOLD_MS);
  }, []);

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      // Has to succeed before leaving: Root's guard sends anyone with onboarding_completed false back here.
      if (signedIn) {
        const { error } = await updateProfile({ onboarding_completed: true });
        if (error) {
          setFinishError(ERROR_LINE);
          return;
        }
      }
      clearLastFinished(userId);
      navigate(signedIn ? redirectTo : "/", { replace: true });
    } catch {
      setFinishError(OFFLINE_LINE);
    } finally {
      setFinishing(false);
    }
  }, [finishing, signedIn, updateProfile, userId, navigate, redirectTo]);

  const next = useCallback(() => {
    writeLastFinished(userId, step);
    const to = nextStep(step);
    if (to) navigate(hrefFor(to), { state: { n: pushed + 1 } });
    else void finish();
  }, [userId, step, navigate, hrefFor, pushed, finish]);

  const backTo = backTarget(step, signedIn);
  const back = useMemo(() => {
    if (!backTo) return null;
    return () => (pushed > 0 ? navigate(-1) : navigate(hrefFor(backTo), { replace: true, state: { n: 0 } }));
  }, [backTo, pushed, navigate, hrefFor]);

  const tone = STEP_TONE[step];
  const api: OnboardingApi = { step, tone, redirectTo, next, back, stubby, react, setStubby, finishing, finishError };

  return (
    <OnboardingContext.Provider value={api}>
      <div className="soosh-transfer min-h-viewport" data-tone={tone}>
        <div className="transfer-column flex min-h-viewport flex-col px-4">
          {isCounted(step) && (
            <>
              <StepHeader step={step} onBack={back} />
              {/* One Stubby for all three taste questions, so its reactions keep playing across the slide. */}
              <div className="flex justify-center pt-6">
                <StepStubby size={120} />
              </div>
            </>
          )}
          {!isCounted(step) && back && (
            <button type="button" className="transfer-icon-button -ml-2 mt-4" aria-label="Back" onClick={back}>
              <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          <AnimatePresence mode="popLayout" custom={dir}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={page} className="flex flex-1 flex-col">
              <PlaceholderScreen />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </OnboardingContext.Provider>
  );
}
