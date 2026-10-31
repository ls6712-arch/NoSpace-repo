import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { HOME } from "../components/nav/navItems";
import { OnboardingField } from "../components/onboarding/OnboardingField";
import { PillButton } from "../components/ui/PillButton";
import { useAuth } from "../context/AuthContext";
import { clearRecoveryKind, peekRecoveryKind } from "../lib/recoveryLink";
import { ScreenFrame } from "./onboarding/screens/ScreenFrame";

/** Shown when the link is no good: past its time, or already used. */
export const EXPIRED_LINE = "This link has expired.";

/**
 * Where a password reset link lands (/reset-password). A good link has already
 * signed the person in (Supabase does that when the page opens), so this asks
 * for one new password and takes them Home. A link that has expired, was used,
 * or never came gets one line and a button for a new link, which opens the log
 * in screen's reset step (no address is kept anywhere, so it asks again). Same
 * one skin as onboarding and log in.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading, isConfigured, updatePassword } = useAuth();
  // What opened this tab. A link Supabase already rejected is known at once; a good one is known once the session loads.
  const [kind] = useState(peekRecoveryKind);
  useEffect(() => clearRecoveryKind(), []);

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const waiting = isConfigured && loading && kind !== "expired";
  const expired = !waiting && (kind === "expired" || !user);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const result = await updatePassword(password);
    busy.current = false;
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(HOME.to, { replace: true });
  };

  const sendNewLink = () => navigate("/login?mode=signin&view=reset", { replace: true });

  const body = waiting ? (
    <div className="flex flex-1 items-center justify-center" aria-live="polite">
      <span className="size-8 animate-spin rounded-full border-2 border-border border-t-foreground" role="status" aria-label="Loading" />
    </div>
  ) : expired ? (
    <ScreenFrame
      title="Reset your password"
      intro={EXPIRED_LINE}
      footer={
        <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={sendNewLink}>
          Send a new link
        </PillButton>
      }
    />
  ) : (
    <form onSubmit={save} className="flex flex-1 flex-col">
      <ScreenFrame
        title="Reset your password"
        footer={
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" type="submit" disabled={saving}>
            Save password
          </PillButton>
        }
      >
        <OnboardingField
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          error={error}
        />
      </ScreenFrame>
    </form>
  );

  return (
    <div className="min-h-viewport">
      <div className="ob-column flex min-h-viewport flex-col px-4">{body}</div>
    </div>
  );
}
