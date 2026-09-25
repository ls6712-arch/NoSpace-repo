import { useState } from "react";
import { useSocial } from "../context/SocialContext";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * One sentence of what blocking actually does, per
 * docs/communication-strategy.md's Phase 1 decisions: full block, both
 * directions, silent (they're never told), unblock anytime from Settings
 * (a follow is not restored on unblock).
 */
export function BlockConfirmDialog({
  open,
  onOpenChange,
  personId,
  personName,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  onBlocked?: () => void;
}) {
  const social = useSocial();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await social.block(personId);
    setBusy(false);
    if (err) {
      setError("Couldn't do that. Try again later.");
      return;
    }
    onOpenChange(false);
    onBlocked?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!busy) onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Block {personName}?</DialogTitle>
          <DialogDescription>
            {personName} won't be able to message you, follow you, or see your Moments. They won't be
            told.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
