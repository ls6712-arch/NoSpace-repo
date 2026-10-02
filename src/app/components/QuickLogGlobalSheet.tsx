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
        {/* Phones: a bottom sheet, thumb-reachable above the tab bar.
            Desktop (where the header's "Log a Moment" opens it): a centered
            card near the top of the window — pinned to the bottom edge of a
            large screen it showed up far from the button, at the very
            bottom of the page. */}
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-card lg:inset-x-0 lg:top-[12vh] lg:bottom-auto lg:w-[calc(100%-2rem)] lg:rounded-card lg:border lg:data-[state=open]:slide-in-from-bottom-4 lg:data-[state=closed]:slide-out-to-bottom-4 lg:data-[state=open]:fade-in-0 lg:data-[state=closed]:fade-out-0"
        >
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
          className="fixed inset-x-0 bottom-[calc(5rem+var(--safe-bottom))] z-50 mx-auto w-[calc(100%-2rem)] max-w-lg animate-in duration-base fade-in slide-in-from-bottom-4 rounded-card border border-border bg-card p-2.5 shadow-overlay lg:top-[12vh] lg:bottom-auto"
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
