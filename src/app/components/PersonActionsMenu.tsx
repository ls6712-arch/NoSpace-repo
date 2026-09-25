import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { BlockConfirmDialog } from "./BlockConfirmDialog";
import { ReportDialog } from "./ReportDialog";

/**
 * The "…" menu next to Following / Message / Share on a profile, and in a
 * conversation's header — Block <name> / Report, per
 * docs/communication-strategy.md Part B.3.
 */
export function PersonActionsMenu({
  personId,
  personName,
  onBlocked,
}: {
  personId: string;
  personName: string;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="icon"
        aria-label={`More about ${personName}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <button
            type="button"
            className="block w-full px-3.5 py-2.5 text-left text-sm text-[var(--coral-text)] transition-colors hover:bg-surface-muted"
            onClick={() => {
              setOpen(false);
              setBlockOpen(true);
            }}
          >
            Block {personName}
          </button>
          <button
            type="button"
            className="block w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted"
            onClick={() => {
              setOpen(false);
              setReportOpen(true);
            }}
          >
            Report
          </button>
        </div>
      )}

      <BlockConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        personId={personId}
        personName={personName}
        onBlocked={onBlocked}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={personId}
        targetKind="profile"
        personName={personName}
      />
    </div>
  );
}
