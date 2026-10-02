import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { claimInvite } from "../lib/invites";
import { formatInviteCodeInput, rawInviteCode } from "../lib/inviteCode";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { WaitlistForm } from "../components/WaitlistForm";
import { APP_NAME } from "../config";

/**
 * /#/welcome — Step 2's door screen. Root.tsx routes every signed-in
 * pending account here and nowhere else (its own pending gate re-checks
 * on every render, so a successful claim below — which reloads the
 * profile — moves on by itself once `access` flips to 'active', no
 * navigate() call needed here). Never reachable signed out: claim_invite
 * only means anything for the current session's own account, and a
 * signed-out visit here just falls through to Root's ordinary
 * not-signed-in redirect to "/".
 */
export function Welcome() {
  const { signOut, refreshProfile, inviteClaimError, clearInviteClaimError } = useAuth();
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A code saved before the sign-in redirect (the arrival page) may have
  // already been tried and found invalid by the time this screen mounts —
  // AuthContext's own bootstrap does that claim attempt before Root.tsx
  // ever routes here. Shown once, then cleared from context so it can't
  // reappear on a later visit.
  useEffect(() => {
    if (!inviteClaimError) return;
    setError(inviteClaimError);
    clearInviteClaimError();
  }, [inviteClaimError]);

  const submit = async () => {
    const raw = rawInviteCode(code);
    if (claiming || !raw) return;
    setClaiming(true);
    setError(null);
    const result = await claimInvite(raw);
    if (result === "invalid") {
      setError("That invite has expired or was already used.");
      setClaiming(false);
      return;
    }
    if (result === "error") {
      setError("Couldn't reach the server. Try again.");
      setClaiming(false);
      return;
    }
    // 'claimed' or 'already_active' — reload the profile; Root.tsx's own
    // pending gate re-evaluates on the next render and moves on once
    // `access` reads back as 'active'.
    await refreshProfile();
    setClaiming(false);
  };

  return (
    <div className="min-h-viewport bg-surface px-5 pb-24 pt-16">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center text-display leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          {APP_NAME} is invite-only for now.
        </h1>

        <div className="mt-8 space-y-3">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(formatInviteCodeInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="XXXX-XXXX"
            className="text-center tracking-widest"
            maxLength={9}
          />
          {error && <p className="text-caption text-destructive">{error}</p>}
          <Button
            variant="coral"
            className="h-11 w-full rounded-control"
            disabled={claiming || !code.trim()}
            onClick={submit}
          >
            {claiming ? "Checking…" : "Continue"}
          </Button>
        </div>

        <div className="mt-10 border-t border-[var(--hairline)] pt-8">
          <p className="mb-3 text-small text-muted-foreground">No invite yet?</p>
          <WaitlistForm />
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-10 block w-full text-center text-small text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
