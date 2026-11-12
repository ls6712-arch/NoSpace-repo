import { useId, useState, type FormEvent } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { appleSignInEnabled } from "../../config";
import { supabase } from "../../../lib/supabase";
import { guestSession, guestSupabase, moveGuestSessionToMain, revokeSession } from "../../../lib/guestSupabase";
import { useAuth } from "../../context/AuthContext";
import { useStubbyAccess } from "../../context/StubbyAccess";
import { track, type SignUpMethod, type SignUpTrigger } from "../../lib/analytics";
import { GUEST_COPY } from "../../lib/guestCopy";
import { saveReturn } from "../../lib/signUpReturn";

/**
 * Sign up without leaving the page (guest brief §5). Google first, Apple when it's switched on,
 * email second. The same buttons log in an existing account, so there is no separate path.
 *
 * A guest who has asked already keeps the same user id: Google and Apple link to the guest
 * (linkIdentity), email verifies an address on the guest (an email-change code). If that Google
 * account or address already has a Soosh account, they log in to it instead; the guest's picks
 * are not merged into it (founder, Nov 2, 2026). Nothing about who the guest is goes in the
 * request: the server knows from the session.
 */
export function SignUpSheet() {
  const access = useStubbyAccess();
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const emailId = useId();
  const codeId = useId();
  const [step, setStep] = useState<"choose" | "email" | "code">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"convert" | "login" | "new">("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = access.prompt;
  const open = p?.kind === "sheet";
  const trigger: SignUpTrigger = p?.kind === "sheet" ? p.trigger : "header";
  const feature = p?.kind === "sheet" ? p.feature : null;
  const body = feature ? GUEST_COPY.gate[feature] : GUEST_COPY.gateKeep(access.accountPerDay);

  const remember = (method: SignUpMethod) => {
    track({ name: "signup_started", trigger, method });
    saveReturn({ trigger, method, draft: access.draft.current, blocked: trigger === "limit", guestMessages: access.guestMessages });
  };

  const oauth = async (provider: "google" | "apple") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    remember(provider);
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    try {
      const guest = await guestSession();
      const r = guest && guestSupabase
        ? await guestSupabase.auth.linkIdentity({ provider, options: { redirectTo } })
        : supabase
          ? await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
          : { error: new Error("no client") };
      if (r.error) throw r.error;
      // The browser is on its way to Google or Apple.
    } catch {
      setError(GUEST_COPY.error);
      setBusy(false);
    }
  };

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) return;
    setBusy(true);
    setError(null);
    remember("email");
    try {
      const guest = await guestSession();
      if (guest && guestSupabase) {
        const { error: e1 } = await guestSupabase.auth.updateUser({ email: address });
        if (!e1) {
          setMode("convert");
          setStep("code");
          return;
        }
        // The address has an account already: log in to it with a code instead.
        if ((e1 as { code?: string }).code !== "email_exists" || !supabase) throw e1;
        const { error: e2 } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
        if (e2) throw e2;
        setMode("login");
        setStep("code");
        return;
      }
      const r = await sendEmailCode(address);
      if (r.error) throw new Error(r.error);
      setMode("new");
      setStep("code");
    } catch {
      setError(GUEST_COPY.error);
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async (e: FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (busy || !/^\d{6,10}$/.test(token)) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "convert" && guestSupabase) {
        const before = await guestSession();
        const { error: e1 } = await guestSupabase.auth.verifyOtp({ email: email.trim(), token, type: "email_change" });
        if (e1) throw e1;
        if (!(await moveGuestSessionToMain())) throw new Error("move");
        // A new session for the account; the guest's old one stops working (no session fixation).
        if (before) void revokeSession(before.access_token);
      } else {
        const r = await verifyEmailCode(email.trim(), token);
        if (r.error) throw new Error(r.error);
      }
      // AuthContext now has the account; SignUpReturnEffect (Root) lands them back here.
    } catch {
      setError(GUEST_COPY.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setStep("choose");
          setCode("");
          setError(null);
          access.dismiss();
        }
      }}
      title={GUEST_COPY.gateTitle}
      description={body}
    >
      <div className="flex flex-col gap-3 pb-2">
        {step === "choose" && (
          <>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => void oauth("google")}>
              {GUEST_COPY.google}
            </Button>
            {appleSignInEnabled && (
              <Button size="lg" variant="outline" className="w-full" disabled={busy} onClick={() => void oauth("apple")}>
                {GUEST_COPY.apple}
              </Button>
            )}
            <Button size="lg" variant="outline" className="w-full" disabled={busy} onClick={() => setStep("email")}>
              {GUEST_COPY.email}
            </Button>
          </>
        )}
        {step === "email" && (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <Label htmlFor={emailId}>{GUEST_COPY.emailLabel}</Label>
            <Input id={emailId} type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-body" />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {GUEST_COPY.sendCode}
            </Button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={checkCode} className="flex flex-col gap-3">
            <Label htmlFor={codeId}>{GUEST_COPY.codeLabel}</Label>
            <Input id={codeId} inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 text-body" />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {GUEST_COPY.signUp}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        <Button variant="ghost" className="w-full" onClick={() => access.dismiss()}>
          {GUEST_COPY.notNow}
        </Button>
      </div>
    </BottomSheet>
  );
}
