import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { TermsCheckbox } from "../../../components/TermsCheckbox";
import { PillButton } from "../../../components/ui/PillButton";
import { OnboardingField } from "../../../components/onboarding/OnboardingField";
import { appleSignInEnabled } from "../../../config";
import { codeWaitLine, TOO_MANY_CODES_SIGNUP_LINE } from "../../../lib/authCopy";
import { useAuth } from "../../../context/AuthContext";
import { clearPasswordOffer, markPasswordOffer, rememberEmail, rememberRedirect } from "../../../lib/onboardingProgress";
import { rememberTermsAcceptance } from "../../../lib/termsAcceptance";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Screen 2: Google, Apple (when it is switched on) or an email code. The box for the Terms comes first. */
export function SignUpScreen() {
  const { next, redirectTo } = useOnboarding();
  const { signInWithGoogle, signInWithApple, sendEmailCode } = useAuth();
  const [agreed, setAgreed] = useState(false);
  // From the log in screen's "New to Soosh? Get started": the address is already typed.
  const [params] = useSearchParams();
  // Or back from the code screen's "Use a different email": the address just typed, selected.
  const carried = params.get("email") ?? "";
  const [emailOpen, setEmailOpen] = useState(!!carried);
  const [email, setEmail] = useState(carried);
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (carried) emailInput.current?.select();
  }, [carried, emailOpen]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Google and Apple leave the page and come back to the site root, so the
  // Terms box and where the person was going are kept on the device meanwhile.
  const viaProvider = async (start: () => Promise<{ error: string | null }>) => {
    if (!agreed || busy) return;
    setError(null);
    setBusy(true);
    rememberTermsAcceptance();
    rememberRedirect(redirectTo);
    // Google and Apple have no code step, so no password is offered.
    clearPasswordOffer();
    const result = await start();
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!agreed || busy) return;
    const mail = email.trim();
    if (!EMAIL.test(mail)) {
      setError("That doesn’t look like an email address.");
      return;
    }
    setError(null);
    setBusy(true);
    rememberTermsAcceptance();
    const result = await sendEmailCode(mail);
    setBusy(false);
    // Asked for too many: a wait, not an error.
    if (result.retryAfterSeconds) {
      setNotice(codeWaitLine(result.retryAfterSeconds));
      return;
    }
    if (result.tooMany) {
      setNotice(TOO_MANY_CODES_SIGNUP_LINE);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    rememberEmail(mail);
    // Set now, not when the code is accepted: the account exists (and the name
    // screen mounts) the moment the code checks out, before anything could set it then.
    markPasswordOffer();
    next();
  };

  return (
    <ScreenFrame
      title="Sign up"
      hero={<StepStubby size={140} />}
      footer={
        emailOpen ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <OnboardingField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              inputRef={emailInput}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              error={error}
              hint={notice ?? undefined}
            />
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" type="submit" disabled={busy || !agreed || !email.trim()}>
              {!email.trim() ? "Add your email" : "Continue"}
            </PillButton>
          </form>
        ) : (
          <>
            <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" disabled={busy || !agreed} onClick={() => void viaProvider(signInWithGoogle)}>
              Continue with Google
            </PillButton>
            {appleSignInEnabled && (
              <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" disabled={busy || !agreed} onClick={() => void viaProvider(signInWithApple)}>
                Continue with Apple
              </PillButton>
            )}
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" disabled={busy || !agreed} onClick={() => setEmailOpen(true)}>
              Continue with email
            </PillButton>
            {error && (
              <p role="alert" className="ob-label text-small">
                {error}
              </p>
            )}
          </>
        )
      }
    >
      <TermsCheckbox checked={agreed} onChange={setAgreed} id="onboarding-terms" />
    </ScreenFrame>
  );
}
