import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { CodeEntry } from "../../components/onboarding/CodeEntry";
import { PillButton } from "../../components/ui/PillButton";
import { OnboardingField } from "../../components/onboarding/OnboardingField";
import { Stubby, type StubbyState } from "../../components/stubby/Stubby";
import { APP_NAME, appleSignInEnabled } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { page } from "../../lib/motionTokens";
import { codeWaitLine, resetSentLine, TOO_MANY_CODES_LINE, WRONG_LOGIN_LINE } from "../../lib/authCopy";
import { readLoginMethod, rememberLoginMethod, type LoginMethod } from "../../lib/loginMethod";
import { clearPasswordOffer, readEmail, rememberEmail, rememberRedirect } from "../../lib/onboardingProgress";
import { signedInTarget } from "../../lib/signInTarget";
import { ERROR_LINE, OFFLINE_LINE } from "../../lib/stateCopy";
import { ScreenFrame } from "../onboarding/screens/ScreenFrame";
import { slide } from "../onboarding/transitions";

/** The log in screens, in the order that decides which way a screen slides. */
const VIEWS = ["welcome", "email", "code", "reset", "resetsent", "signingin"] as const;
type View = (typeof VIEWS)[number];
const isView = (v: string | null): v is View => !!v && (VIEWS as readonly string[]).includes(v);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** How long Stubby's stamp has to land before the screen moves on, and how long to wait for the profile. */
const STAMP_BEAT_MS = 600;
const PROFILE_WAIT_MS = 6000;
const REACTION_HOLD_MS = 150;


/**
 * The returning-user door, in the Soosh onboarding look (Transfer frame and
 * Stubby). Codes first: Google, Apple (when it is on) or an emailed code, with
 * a password too (both on one screen, equal, the last one used first). Nobody is signed up from
 * here, and an email with no account looks exactly like one with an account
 * (same screen, same words, same wait), so nothing on it says who is new. A signed-in person with
 * onboarding unfinished is sent back into it; it resumes where they stopped.
 *
 * The screen lives in the URL (`?view=`) so the back button works. Only used
 * while `sooshOnboardingEnabled` is on; the old page is untouched otherwise.
 */
export function LoginV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const reduce = useReducedMotion() ?? false;
  const { user, profile, loading, isConfigured, signInWithGoogle, signInWithApple, sendSignInCode, signIn, resetPassword } = useAuth();
  const redirectTo = params.get("redirect") || "/";

  // Sign up now happens in the onboarding; only ?mode=signin stays here.
  const wantsSignUp = params.get("mode") !== "signin";
  useEffect(() => {
    if (wantsSignUp && !user) navigate(`/onboarding?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [wantsSignUp, user, navigate, redirectTo]);

  const requested = params.get("view");
  const [email, setEmail] = useState(() => readEmail());
  const view: View = isView(requested) && (requested !== "code" || email) ? requested : "welcome";
  const pushed = (location.state as { n?: number } | null)?.n ?? 0;

  const hrefFor = useCallback(
    (v: View) => {
      const q = new URLSearchParams({ mode: "signin", view: v });
      if (params.get("redirect")) q.set("redirect", redirectTo);
      return `/login?${q.toString()}`;
    },
    [params, redirectTo],
  );
  const go = useCallback((v: View) => navigate(hrefFor(v), { state: { n: pushed + 1 } }), [navigate, hrefFor, pushed]);
  const back = view === "welcome" || view === "signingin" ? null : () => (pushed > 0 ? navigate(-1) : navigate(hrefFor("welcome"), { replace: true, state: { n: 0 } }));

  // Direction for the slide, read before the ref moves on.
  const shownBefore = useRef<View | null>(null);
  const dir = shownBefore.current === null || shownBefore.current === view ? 0 : VIEWS.indexOf(view) > VIEWS.indexOf(shownBefore.current) ? 1 : -1;
  useEffect(() => {
    shownBefore.current = view;
  }, [view]);

  // Stubby sleeps on the welcome until the first tap or focus, then wakes (its own wake beat).
  const [awake, setAwake] = useState(false);
  const [reaction, setReaction] = useState<{ view: View; state: StubbyState } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const react = useCallback(
    (state: StubbyState) => {
      clearTimeout(holdTimer.current);
      setReaction({ view, state });
      holdTimer.current = setTimeout(() => setReaction((r) => (r?.view === view ? { view, state: "idle" } : r)), REACTION_HOLD_MS);
    },
    [view],
  );
  // A state held until the next one (thinking while a code is awaited or checked), unlike react's brief one.
  const hold = useCallback(
    (state: StubbyState) => {
      clearTimeout(holdTimer.current);
      setReaction({ view, state });
    },
    [view],
  );
  const stubby: StubbyState =
    view === "signingin" ? "thinking" : reaction?.view === view ? reaction.state : view === "welcome" && !awake ? "sleep" : "idle";

  // Signed in (a fresh sign-in, or already signed in when the page opened): leave once the profile is known.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!user || !leaving) return;
    if (profile) {
      navigate(signedInTarget(profile, redirectTo), { replace: true });
      return;
    }
    const id = setTimeout(() => navigate(redirectTo, { replace: true }), PROFILE_WAIT_MS);
    return () => clearTimeout(id);
  }, [user, profile, leaving, navigate, redirectTo]);
  // Someone already signed in when the page opened (or back from Google or Apple) just moves on.
  // A sign-in made on this page waits for Stubby's stamp first, so it marks itself here.
  const signingInHere = useRef(false);
  useEffect(() => {
    if (user && !loading && !signingInHere.current) setLeaving(true);
  }, [user, loading]);
  const signedIn = useCallback(() => {
    react("stamped");
    setTimeout(
      () => {
        navigate(hrefFor("signingin"), { replace: true, state: { n: 0 } });
        setLeaving(true);
      },
      reduce ? 0 : STAMP_BEAT_MS,
    );
  }, [react, navigate, hrefFor, reduce]);

  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // A wait, not a failure: too many codes were asked for.
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  // The way this device last logged in is shown first; both stay equal in size.
  const [method] = useState<LoginMethod>(() => readLoginMethod());
  // "Log in with password" on the code screen comes back here with the password field in focus.
  const [focusPassword, setFocusPassword] = useState(false);
  // "Use a different email" comes back with the address filled in and its text selected.
  const [selectEmail, setSelectEmail] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (view === "email" && selectEmail) {
      emailInput.current?.focus();
      emailInput.current?.select();
      setSelectEmail(false);
    }
  }, [view, selectEmail]);

  const viaProvider = async (start: () => Promise<{ error: string | null }>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    // The round trip lands on the site root; keep where the person was going.
    rememberRedirect(redirectTo);
    clearPasswordOffer();
    const result = await start();
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (busy) return;
    const mail = email.trim();
    if (!EMAIL.test(mail)) {
      setError("That doesn’t look like an email address.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    // Never signs anyone up, and an address with no account gets the same
    // answer, the same screen and the same wait as one with an account.
    const result = await sendSignInCode(mail);
    setBusy(false);
    if (result.retryAfterSeconds) {
      setNotice(codeWaitLine(result.retryAfterSeconds));
      return;
    }
    if (result.tooMany) {
      setNotice(TOO_MANY_CODES_LINE);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    rememberEmail(mail);
    rememberLoginMethod("code");
    // A log in is not a sign-up: drop any offer left over from one that was abandoned.
    clearPasswordOffer();
    go("code");
  };

  const logInWithPassword = async () => {
    if (busy) return;
    const mail = email.trim();
    if (!EMAIL.test(mail)) {
      setError("That doesn’t look like an email address.");
      return;
    }
    setError(null);
    setPasswordError(null);
    setNotice(null);
    setBusy(true);
    signingInHere.current = true;
    const result = await signIn(mail, password);
    setBusy(false);
    if (result.error) {
      signingInHere.current = false;
      react("shrug");
      // One message for a wrong email, a wrong password and an account with no
      // password; only a dead connection or a rate limit is worded differently.
      setPasswordError(result.status === 0 || /failed to fetch|network/i.test(result.error) ? OFFLINE_LINE : result.status === 429 ? ERROR_LINE : WRONG_LOGIN_LINE);
      return;
    }
    rememberLoginMethod("password");
    clearPasswordOffer();
    signedIn();
  };

  const sendReset = async () => {
    if (busy) return;
    const mail = email.trim();
    if (!EMAIL.test(mail)) {
      setError("That doesn’t look like an email address.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await resetPassword(mail);
    setBusy(false);
    // Supabase answers the same for an unknown address, so the confirmation cannot be used to find out who has an account.
    if (result.error) {
      setError(result.error);
      return;
    }
    go("resetsent");
  };

  // Opens sign-up with the address already typed.
  const getStartedHref = `/onboarding?step=signup&email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirectTo)}`;

  const emailField = (autoFocus: boolean) => (
    <OnboardingField
      label="Email"
      type="email"
      inputMode="email"
      autoComplete="email"
      autoFocus={autoFocus}
      inputRef={emailInput}
      value={email}
      onChange={(e) => {
        setEmail(e.target.value);
        setError(null);
      }}
      error={view === "email" || view === "reset" ? error : null}
      hint={view === "email" ? (notice ?? undefined) : undefined}
    />
  );
  const needEmail = !email.trim() ? "Add your email" : null;

  const body = (() => {
    switch (view) {
      case "welcome":
        return (
          <ScreenFrame
            title="Welcome back."
            footer={
              <>
                <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" disabled={busy} onClick={() => void viaProvider(signInWithGoogle)}>
                  Continue with Google
                </PillButton>
                {appleSignInEnabled && (
                  <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" disabled={busy} onClick={() => void viaProvider(signInWithApple)}>
                    Continue with Apple
                  </PillButton>
                )}
                <PillButton data-variant="primary" className="ob-button w-full min-h-14" disabled={busy} onClick={() => go("email")}>
                  Continue with email
                </PillButton>
                <p aria-live="polite" className={error ? "ob-label text-small" : "sr-only"}>
                  {error}
                </p>
                <button type="button" className="ob-link self-center" onClick={() => navigate("/onboarding")}>
                  New here? Get started
                </button>
              </>
            }
          />
        );
      case "email": {
        const codeButton = (
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" key="code" variant="outline" disabled={busy || !!needEmail} onClick={() => void sendCode()}>
            Send me a code
          </PillButton>
        );
        const passwordButton = (
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" key="password" variant="outline" disabled={busy || !!needEmail || !password} onClick={() => void logInWithPassword()}>
            Log in with password
          </PillButton>
        );
        return (
          <ScreenFrame
            title="Log in"
            footer={
              // Two equal buttons; the one this device used last comes first.
              <>{method === "password" ? [passwordButton, codeButton] : [codeButton, passwordButton]}</>
            }
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (password || method === "password") void logInWithPassword();
                else void sendCode();
              }}
            >
              {emailField(!focusPassword)}
              <div>
                <OnboardingField
                  label="Password (if you have one)"
                  type="password"
                  autoComplete="current-password"
                  autoFocus={focusPassword}
                  error={passwordError}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                />
                <button type="button" className="ob-link mt-1" onClick={() => go("reset")}>
                  Forgot your password?
                </button>
              </div>
            </form>
          </ScreenFrame>
        );
      }
      case "code":
        return (
          <CodeEntry
            email={email}
            hero={null}
            resend={sendSignInCode}
            onDifferentEmail={() => {
              setSelectEmail(true);
              go("email");
            }}
            onPassword={() => {
              setFocusPassword(true);
              go("email");
            }}
            footer={
              <button type="button" className="ob-link self-center" onClick={() => navigate(getStartedHref)}>
                New to Soosh? Get started
              </button>
            }
            onThinking={(thinking) => hold(thinking ? "thinking" : "idle")}
            onChecking={(checking) => {
              if (checking) signingInHere.current = true;
            }}
            onWrong={() => {
              signingInHere.current = false;
              react("shrug");
            }}
            onVerified={signedIn}
          />
        );
      case "reset":
        return (
          <ScreenFrame
            title="Reset your password"
            footer={
              <PillButton data-variant="primary" className="ob-button w-full min-h-14" disabled={busy || !!needEmail} onClick={() => void sendReset()}>
                {needEmail ?? "Send reset link"}
              </PillButton>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendReset();
              }}
            >
              {emailField(true)}
            </form>
          </ScreenFrame>
        );
      case "resetsent":
        return (
          <ScreenFrame
            title="Check your email"
            intro={resetSentLine(email.trim())}
            footer={<PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => go("email")}>Log in</PillButton>}
          />
        );
      case "signingin":
        return <ScreenFrame title="Signing you in…" />;
    }
  })();

  if (!isConfigured) {
    return (
      <div className="min-h-viewport">
        <div className="ob-column flex min-h-viewport flex-col px-4">
          <ScreenFrame
            title="Accounts aren’t set up on this build"
            intro={`This copy of ${APP_NAME} isn’t connected to a database yet, so there’s no real sign-up here. Everything still works in local demo mode.`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-viewport" onPointerDownCapture={() => setAwake(true)} onFocusCapture={() => setAwake(true)}>
      <div className="ob-column flex min-h-viewport flex-col px-4">
        {back ? (
          <button type="button" className="ob-icon-button -ml-2 mt-4" aria-label="Back" onClick={back}>
            <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </button>
        ) : (
          <div className="mt-4 h-11" aria-hidden="true" />
        )}
        {/* One Stubby for every log in screen, so it can wake up and then keep reacting. */}
        <div className="flex justify-center pt-4">
          <Stubby state={stubby} size={view === "welcome" ? 180 : 120} followPointer={view === "email"} />
        </div>
        <AnimatePresence mode="popLayout" custom={dir}>
          <motion.div key={view} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={page} className="flex flex-1 flex-col">
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
