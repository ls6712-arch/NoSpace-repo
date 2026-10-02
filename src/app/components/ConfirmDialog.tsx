import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

/**
 * A yes/no gate for anything permanent — deleting a Moment, deleting a
 * Private Log, anything else that can't be undone by re-doing it. One
 * component so every "are you sure" in the app reads and behaves the same
 * way, rather than each delete button growing its own slightly different
 * confirmation.
 *
 * Never dismissed by clicking outside — a decision this final has to be an
 * actual choice, not something a stray tap makes fall away. Escape is the
 * same as Cancel (the safe answer), so keyboard users can always back out.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Can be async — the dialog stays open and the confirm button shows a
   * busy state until it resolves, so a slow delete can't be double-fired
   * by an impatient second click. */
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirming) onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (confirming) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={confirming}>
            {confirming ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
