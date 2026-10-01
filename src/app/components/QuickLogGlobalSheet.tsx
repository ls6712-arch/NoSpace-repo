import { useEffect, useState } from "react";
import { useQuickLog } from "../context/QuickLogContext";
import { LoggedNotice, QuickLog, SavedMoment } from "./QuickLog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

/**
 * The "+" tab's entry point when there's no Pursuit already in view (see
 * BottomTabBar.tsx) — same QuickLog core every Pursuit page already embeds
 * inline, just opened as a bottom sheet instead, since there's no page
 * underneath it to embed into. Mounted once, next to CartDrawer, so any
 * "+"-style control anywhere in the app can open it through QuickLogContext
 * without needing its own copy.
 *
 * Once a Moment is logged the sheet closes straight away and the
 * "Logged · Undo" confirmation floats above the page on its own — no dimmed,
 * blurred overlay left behind for the length of the undo window.
 */
export function QuickLogGlobalSheet() {
  const { open, closeQuickLog } = useQuickLog();
  const [logged, setLogged] = useState<{ saved: SavedMoment; offer: boolean; key: number } | null>(
    null,
  );

  // Opening the composer again replaces any confirmation still on screen.
  useEffect(() => {
    if (open) setLogged(null);
  }, [open]);

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && closeQuickLog()}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
          <SheetHeader>
            <SheetTitle style={{ fontFamily: "var(--font-serif)" }}>New Moment</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {open && (
              <QuickLog
                autoFocus
                compact={false}
                onDone={closeQuickLog}
                onSaved={(saved, offer) => {
                  closeQuickLog();
                  setLogged({ saved, offer, key: Date.now() });
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {logged && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-20 z-50 mx-auto w-[calc(100%-2rem)] max-w-lg animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-border bg-card p-2.5 shadow-2xl lg:bottom-6"
        >
          <LoggedNotice
            key={logged.key}
            saved={logged.saved}
            offerPursuitName={logged.offer}
            onDone={() => setLogged(null)}
          />
        </div>
      )}
    </>
  );
}
