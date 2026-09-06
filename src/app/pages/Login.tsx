import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function Login() {
  const { user, signIn, signUp, resetPassword, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  // Reached directly (e.g. a stale /login link) while already signed in —
  // send them on rather than showing the form again.
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user]);

  // The nav button says "Log in", so ?mode=signin lands on the login form.
  // It used to always open Sign up, and the only way back was a small link
  // at the bottom of the page.
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signin" ? "signin" : "signup",
  );
  const [resetSent, setResetSent] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Checked here as well as by the browser, because an account created with
  // a typo'd address can never be recovered — there's nowhere to send the
  // reset mail.
  const validate = () => {
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      return "That doesn't look like an email address.";
    }
    if (password.length < 8) {
      return "Your password needs at least 8 characters.";
    }
    if (mode === "signup" && !displayName.trim()) {
      return "What should people call you?";
    }
    return null;
  };

  const sendReset = async () => {
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setError("Type your email address above first, then tap this again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await resetPassword(mail);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setResetSent(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signup"
          ? await signUp(email, password, displayName)
          : await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      navigate(redirectTo);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      // Without this, a thrown error left the button reading "One sec..."
      // forever and the only way out was reloading the page.
      setSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel rounded-3xl p-8 text-center max-w-sm">
          <AlertCircle className="size-8 mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-xl mb-2">Accounts aren't set up on this build</h2>
          <p className="text-sm text-muted-foreground">
            This copy of NoSpace isn't connected to a database yet, so there's no real
            sign-up here. Everything still works in local demo mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex size-12 items-center justify-center rounded-full text-white mb-4 [background-image:var(--gradient-brand)]">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-2xl mb-1">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup"
              ? "Real work, saved for real, not just this browser tab."
              : "Log in to pick up where you left off."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="displayName" className="mb-2 block">
                Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="mb-2 block">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <Label htmlFor="password" className="mb-2 block">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {mode === "signup" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">At least 8 characters.</p>
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={sendReset}
                className="mt-2 text-xs text-[var(--coral-text)] hover:underline"
              >
                Forgot your password?
              </button>
            )}
          </div>

          {resetSent && (
            <p className="rounded-xl border border-[var(--hairline)] bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              If there's an account for that address, a reset link is on its way.
              Check your spam folder if it doesn't arrive.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 px-3 py-2.5 text-xs text-[var(--coral)]">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "One sec..." : mode === "signup" ? "Sign up" : "Log in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-5">
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="text-[var(--coral-text)] hover:underline"
            onClick={() => {
              setError(null);
              setMode((m) => (m === "signup" ? "signin" : "signup"));
            }}
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
