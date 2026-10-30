import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { StepHeader } from "../../components/onboarding/StepHeader";
import type { StubbyState } from "../../components/stubby/Stubby";
import { useAuth } from "../../context/AuthContext";
import {
  clearLastFinished,
  isRealRedirect,
  laterStep,
  peekRedirect,
  readLastFinished,
  takeRedirect,
  writeLastFinished,
} from "../../lib/onboardingProgress";
import { fetchRemoteStep, saveRemoteStep } from "../../lib/onboardingRemote";
import { page } from "../../lib/motionTokens";
import { slide } from "./transitions";
import { ERROR_LINE, OFFLINE_LINE } from "../../lib/stateCopy";
import { OnboardingContext, type OnboardingApi } from "./OnboardingContext";
import { PlaceholderScreen } from "./PlaceholderScreen";
import { StepStubby } from "./StepStubby";
import { screenFor } from "./screens";
import {
  STEP_STUBBY,
  STEP_TONE,
  backTarget,
  isCounted,
  nextStep,
  resolveStep,
  slideDirection,
  type OnboardingStep,
} from "./steps";

/** How long a one-shot reaction is held before Stubby goes back to idle, so the same reaction can play again. */
const REACTION_HOLD_MS = 150;
/** How long the next screen waits for Stubby's stamp to land. */
const STAMP_BEAT_MS = 600;

/**
 * The onboarding step router (Soosh onboarding brief, section 2). The step
 * lives in the URL (`?step=name`), so the browser and Android back buttons
 * and swipe-back walk the screens. Each Next saves the last finished step, on
 * this device and on the account, and reopening the app resumes after it.
 *
 * Arriving from an invite link keeps `?invite=` or `?redirect=/join/...`
 * through every step. A Google or Apple round trip lands on the site root and
 * loses the URL, so the destination is kept on the device meanwhile.
 */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const reduce = useReducedMotion() ?? false;
  const { user, updateProfile, isConfigured } = useAuth();
  const userId = user?.id;
  const signedIn = !!user;
  const inviteCode = params.get("invite");
  // An address typed on the log in screen, carried to sign up so it is not typed twice.
  const emailParam = params.get("email");

  // The destination: the URL's, else the one kept across a sign-in round trip, else Discover.
  const urlRedirect = params.get("redirect");
  const [kept] = useState(() => (isRealRedirect(urlRedirect) ? null : peekRedirect()));
  const redirectTo = isRealRedirect(urlRedirect) ? urlRedirect : (kept ?? "/discover");

  // The account's own saved step, read once per person.
  const [remote, setRemote] = useState<{ userId: string; step: OnboardingStep | null } | null>(null);
  useEffect(() => {
    if (!userId || !isConfigured) return;
    let live = true;
    void fetchRemoteStep(userId).then((step) => live && setRemote({ userId, step }));
    return () => {
      live = false;
    };
  }, [userId, isConfigured]);
  const waiting = signedIn && isConfigured && remote?.userId !== userId;

  const lastFinished = laterStep(readLastFinished(userId), remote && remote.userId === userId ? remote.step : null);
  const step = resolveStep(params.get("step"), lastFinished, signedIn, !isConfigured);
  const hrefFor = useCallback(
    (s: OnboardingStep) => {
      const q = new URLSearchParams({ step: s, redirect: redirectTo });
      if (inviteCode) q.set("invite", inviteCode);
      if (emailParam) q.set("email", emailParam);
      return `/onboarding?${q.toString()}`;
    },
    [redirectTo, inviteCode, emailParam],
  );

  // A missing or out-of-reach ?step= is replaced with the screen the person should be on.
  useEffect(() => {
    if (!waiting && params.get("step") !== step) navigate(hrefFor(step), { replace: true, state: { n: 0 } });
  }, [waiting, params, step, navigate, hrefFor]);

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
  const beatTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      clearTimeout(beatTimer.current);
    },
    [],
  );
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
      takeRedirect();
      navigate(signedIn ? redirectTo : "/", { replace: true });
    } catch {
      setFinishError(OFFLINE_LINE);
    } finally {
      setFinishing(false);
    }
  }, [finishing, signedIn, updateProfile, userId, navigate, redirectTo]);

  const advancing = useRef(false);
  const next = useCallback(
    (opts?: { stamp?: boolean; reaction?: StubbyState }) => {
      if (advancing.current) return;
      const go = () => {
        advancing.current = false;
        const from = stepNow.current;
        writeLastFinished(userId, from);
        if (userId) {
          void saveRemoteStep(userId, from);
          setRemote((r) => (r && r.userId === userId ? { ...r, step: laterStep(r.step, from) } : r));
        }
        const to = nextStep(from);
        if (to) navigate(hrefFor(to), { state: { n: pushed + 1 } });
        else void finish();
      };
      const reaction = opts?.reaction ?? (opts?.stamp ? "stamped" : null);
      if (reaction && !reduce) {
        advancing.current = true;
        react(reaction);
        beatTimer.current = setTimeout(go, STAMP_BEAT_MS);
      } else {
        go();
      }
    },
    [userId, navigate, hrefFor, pushed, finish, react, reduce],
  );

  const backTo = backTarget(step, signedIn);
  const back = useMemo(() => {
    if (!backTo) return null;
    return () => (pushed > 0 ? navigate(-1) : navigate(hrefFor(backTo), { replace: true, state: { n: 0 } }));
  }, [backTo, pushed, navigate, hrefFor]);

  const tone = STEP_TONE[step];
  const api: OnboardingApi = {
    step,
    tone,
    redirectTo,
    signedIn,
    inviteCode,
    next,
    back,
    stubby,
    react,
    setStubby,
    finishing,
    finishError,
  };

  if (waiting) {
    return (
      <div className="soosh-transfer flex min-h-viewport items-center justify-center" data-tone="platform">
        <span className="size-8 animate-spin rounded-full border-2 border-[var(--transfer-line)] border-t-[var(--transfer-cobalt)]" role="status" aria-label="Loading" />
      </div>
    );
  }

  const Screen = screenFor(step) ?? PlaceholderScreen;
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
              <Screen />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </OnboardingContext.Provider>
  );
}
