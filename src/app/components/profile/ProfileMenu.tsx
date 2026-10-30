import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { BlockConfirmDialog } from "../BlockConfirmDialog";
import { ConfirmDialog } from "../ConfirmDialog";
import { ReportDialog } from "../ReportDialog";

/** The More menu on someone else's profile: Unfollow (when following), Block, Report. */
export function ProfileMenu({
  personId,
  personName,
  following,
  onUnfollow,
  onBlocked,
}: {
  personId: string;
  personName: string;
  following: boolean;
  onUnfollow: () => void | Promise<void>;
  onBlocked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [unfollowOpen, setUnfollowOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const item = "block min-h-11 w-full px-3.5 py-2.5 text-left text-small transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted";
  const choose = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="icon" className="size-11" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-card border border-border bg-popover shadow-overlay">
          {following && (
            <button type="button" role="menuitem" className={item} onClick={choose(() => setUnfollowOpen(true))}>
              Unfollow
            </button>
          )}
          <button type="button" role="menuitem" className={`${item} text-[var(--coral-text)]`} onClick={choose(() => setBlockOpen(true))}>
            Block
          </button>
          <button type="button" role="menuitem" className={item} onClick={choose(() => setReportOpen(true))}>
            Report
          </button>
        </div>
      )}
      <ConfirmDialog
        open={unfollowOpen}
        onOpenChange={setUnfollowOpen}
        title={`Unfollow ${personName}?`}
        confirmLabel="Unfollow"
        onConfirm={async () => {
          await onUnfollow();
          setUnfollowOpen(false);
        }}
      />
      <BlockConfirmDialog open={blockOpen} onOpenChange={setBlockOpen} personId={personId} personName={personName} onBlocked={onBlocked} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetUserId={personId} targetKind="profile" personName={personName} />
    </div>
  );
}
