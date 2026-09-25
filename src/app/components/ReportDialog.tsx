import { useState } from "react";
import { useSocial, ReportReason, ReportTargetKind } from "../context/SocialContext";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "other", label: "Other" },
];

/**
 * Reporting a profile, message, Moment or Thought — always names the
 * person it's about (target_user_id), so "Also block" is always offered,
 * per docs/communication-strategy.md's Phase 1 decisions.
 */
export function ReportDialog({
  open,
  onOpenChange,
  targetUserId,
  targetKind,
  targetId,
  personName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetKind: ReportTargetKind;
  targetId?: number | string;
  personName: string;
}) {
  const social = useSocial();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setReason("spam");
    setNote("");
    setAlsoBlock(false);
    setError(null);
    setSent(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: reportError } = await social.report({
      targetUserId,
      targetKind,
      targetId,
      reason,
      note: note.trim() || undefined,
    });
    if (reportError) {
      setBusy(false);
      setError("Couldn't send that. Try again later.");
      return;
    }
    if (alsoBlock) {
      await social.block(targetUserId);
    }
    setBusy(false);
    setSent(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {sent ? "Report sent" : "Report"}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Report sent. Thanks for telling us.</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2.5 text-sm">
                  <RadioGroupItem value={r.value} />
                  {r.label}
                </label>
              ))}
            </RadioGroup>
            <Textarea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else we should know? (optional)"
              className="min-h-20"
            />
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Also block {personName}</span>
              <Switch checked={alsoBlock} onCheckedChange={setAlsoBlock} />
            </label>
            {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="coral" className="flex-1" onClick={submit} disabled={busy}>
                Send report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
