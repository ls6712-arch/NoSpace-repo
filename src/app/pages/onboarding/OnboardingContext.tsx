import { createContext, useContext } from "react";
import type { StubbyState } from "../../components/stubby/Stubby";
import type { OnboardingStep, Tone } from "./steps";

export type OnboardingApi = {
  step: OnboardingStep;
  tone: Tone;
  /** Where the flow will land when it ends (`?redirect=`). */
  redirectTo: string;
  /** Signed in with an account (false before the code is accepted). */
  signedIn: boolean;
  /** The friend this person is arriving with (`?invite=` or a Pursuit link), if any. */
  inviteCode: string | null;
  /**
   * The current screen is done: save the step and open the next one (or
   * finish). With `stamp`, Stubby stamps first; with `reaction`, it plays that
   * one (a shrug for a skip). The next screen opens after that beat (straight
   * away under reduced motion).
   */
  next: (opts?: { stamp?: boolean; reaction?: StubbyState }) => void;
  /** Back one screen; null when this screen has no Back. */
  back: (() => void) | null;
  /** Stubby's state. Screens read it through <StepStubby /> and change it with the two below. */
  stubby: StubbyState;
  /** Play a reaction once. Calling it again with the same state plays it again. */
  react: (state: StubbyState) => void;
  /** Hold a looping state (thinking) until the next call. */
  setStubby: (state: StubbyState) => void;
  /** True while the last screen's save is in flight. */
  finishing: boolean;
  finishError: string | null;
};

export const OnboardingContext = createContext<OnboardingApi | null>(null);

export function useOnboarding(): OnboardingApi {
  const api = useContext(OnboardingContext);
  if (!api) throw new Error("useOnboarding must be used inside the onboarding flow");
  return api;
}
