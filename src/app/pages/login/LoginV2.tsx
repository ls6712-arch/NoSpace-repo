import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { CodeEntry } from "../../components/onboarding/CodeEntry";
import { TransferButton } from "../../components/onboarding/TransferButton";
import { TransferField } from "../../components/onboarding/TransferField";
import { Stubby, type StubbyState } from "../../components/stubby/Stubby";
import { APP_NAME, appleSignInEnabled } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { page } from "../../lib/motionTokens";
import { readEmail, rememberEmail, rememberRedirect } from "../../lib/onboardingProgress";
import { signedInTarget } from "../../lib/signInTarget";
import { ERROR_LINE } from "../../lib/stateCopy";
import { ScreenFrame } from "../onboarding/screens/ScreenFrame";
import { slide } from "../onboarding/transitions";

/** The log in screens, in the order that decides which way a screen slides. */
const VIEWS = ["welcome", "email", "code", "password", "reset", "resetsent", "noaccount", "signingin"] as const;
type View = (typeof VIEWS)[number];
const isView = (v: string | null): v is View => !!v && (VIEWS as readonly string[]).includes(v);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** How long Stubby's stamp has to land before the screen moves on, and how long to wait for the profile. */
const STAMP_BEAT_MS = 600;
const PROFILE_WAIT_MS = 6000;
const REACTION_HOLD_MS = 150;

export const WRONG_PASSWORD_LINE = "That email and password didn’t match.";

/**
 * The returning-user door, in the Soosh onboarding look (Transfer frame and
 * Stubby). Codes first: Google, Apple (when it is on) or an emailed code, with
 * the password behind "Use my password instead". An email with no account goes
 * to Get started and is never signed up from here. A signed-in person with
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
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  const viaProvider = async (start: () => Promise<{ error: string | null }>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    // The round trip lands on the site root; keep where the person was going.
    rememberRedirect(redirectTo);
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
    setBusy(true);
    // Never signs anyone up: an address with no account goes to Get started.
    const result = await sendSignInCode(mail);
    setBusy(false);
    if (result.noAccount) {
      go("noaccount");
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    rememberEmail(mail);
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
    setBusy(true);
    signingInHere.current = true;
    const result = await signIn(mail, password);
    setBusy(false);
    if (result.error) {
      signingInHere.current = false;
      react("shrug");
      setError(/invalid login credentials/i.test(result.error) ? WRONG_PASSWORD_LINE : ERROR_LINE);
      return;
    }
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

  const emailField = (autoFocus: boolean) => (
    <TransferField
      label="Email"
      type="email"
      inputMode="email"
      autoComplete="email"
      autoFocus={autoFocus}
      value={email}
      onChange={(e) => {
        setEmail(e.target.value);
        setError(null);
      }}
      error={view === "email" || view === "reset" ? error : null}
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
                <TransferButton variant="plain" disabled={busy} onClick={() => void viaProvider(signInWithGoogle)}>
                  Continue with Google
                </TransferButton>
                {appleSignInEnabled && (
                  <TransferButton variant="plain" disabled={busy} onClick={() => void viaProvider(signInWithApple)}>
                    Continue with Apple
                  </TransferButton>
                )}
                <TransferButton disabled={busy} onClick={() => go("email")}>
                  Continue with email
                </TransferButton>
                <p aria-live="polite" className={error ? "transfer-label text-small" : "sr-only"}>
                  {error}
                </p>
                <button type="button" className="transfer-link self-center" onClick={() => navigate("/onboarding")}>
                  New here? Get started
                </button>
              </>
            }
          />
        );
      case "email":
        return (
          <ScreenFrame
            title="Log in"
            footer={
              <>
                <TransferButton disabled={busy || !!needEmail} onClick={() => void sendCode()}>
                  {needEmail ?? "Send me a code"}
                </TransferButton>
                <button type="button" className="transfer-link self-center" onClick={() => go("password")}>
                  Use my password instead
                </button>
              </>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              {emailField(true)}
            </form>
          </ScreenFrame>
        );
      case "code":
        return (
          <CodeEntry
            email={email}
            hero={null}
            resend={async (e) => ({ error: (await sendSignInCode(e)).error })}
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
      case "password":
        return (
          <ScreenFrame
            title="Log in"
            footer={
              <>
                <TransferButton disabled={busy || !!needEmail || !password} onClick={() => void logInWithPassword()}>
                  {needEmail ?? (!password ? "Add your password" : "Log in")}
                </TransferButton>
                <button type="button" className="transfer-link self-center" onClick={() => go("reset")}>
                  Forgot your password?
                </button>
              </>
            }
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void logInWithPassword();
              }}
            >
              {emailField(!email)}
              <TransferField
                label="Password"
                type="password"
                autoComplete="current-password"
                autoFocus={!!email}
                error={view === "password" ? error : null}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
            </form>
          </ScreenFrame>
        );
      case "reset":
        return (
          <ScreenFrame
            title="Reset your password"
            footer={
              <TransferButton disabled={busy || !!needEmail} onClick={() => void sendReset()}>
                {needEmail ?? "Send reset link"}
              </TransferButton>
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
            intro="If there’s an account for that address, a reset link is on its way. Check your spam folder if it doesn’t arrive."
            footer={<TransferButton onClick={() => go("password")}>Log in</TransferButton>}
          />
        );
      case "noaccount":
        return (
          <ScreenFrame
            title="No Soosh account for that email yet."
            footer={
              <>
                <TransferButton
                  onClick={() => navigate(`/onboarding?step=signup&email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirectTo)}`)}
                >
                  Get started
                </TransferButton>
                <button type="button" className="transfer-link self-center" onClick={() => go("email")}>
                  Use a different email
                </button>
              </>
            }
          />
        );
      case "signingin":
        return <ScreenFrame title="Signing you in…" />;
    }
  })();

  if (!isConfigured) {
    return (
      <div className="soosh-transfer min-h-viewport" data-tone="platform">
        <div className="transfer-column flex min-h-viewport flex-col px-4">
          <ScreenFrame
            title="Accounts aren’t set up on this build"
            intro={`This copy of ${APP_NAME} isn’t connected to a database yet, so there’s no real sign-up here. Everything still works in local demo mode.`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="soosh-transfer min-h-viewport" data-tone="platform" onPointerDownCapture={() => setAwake(true)} onFocusCapture={() => setAwake(true)}>
      <div className="transfer-column flex min-h-viewport flex-col px-4">
        {back ? (
          <button type="button" className="transfer-icon-button -ml-2 mt-4" aria-label="Back" onClick={back}>
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
