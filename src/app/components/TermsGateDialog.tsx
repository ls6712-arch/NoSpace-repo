import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { TermsCheckbox } from "./TermsCheckbox";
import { recordTermsAcceptance } from "../lib/termsAcceptance";
import { ERROR_LINE, OFFLINE_LINE } from "../lib/stateCopy";

/** Shown once to an existing account with no recorded acceptance. It can't be
 * closed: the only ways out are accepting or logging out. Accepting asks the
 * database to stamp the time (see lib/termsAcceptance.ts); nothing else about
 * the account is touched. */
export function TermsGateDialog({ open, onAccepted }: { open: boolean; onAccepted: () => void }) {
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!agreed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await recordTermsAcceptance();
      if (err) {
        setError(ERROR_LINE);
        return;
      }
      onAccepted();
    } catch {
      setError(OFFLINE_LINE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Terms and Privacy Policy</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void accept();
          }}
        >
          <TermsCheckbox checked={agreed} onChange={setAgreed} id="gate-terms" />
          {error && <p className="text-caption text-[var(--coral-text)]">{error}</p>}
          <Button busy={saving} type="submit" variant="coral" className="w-full" disabled={!agreed || saving}>
            Continue
          </Button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 w-full text-small text-muted-foreground transition-colors hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
