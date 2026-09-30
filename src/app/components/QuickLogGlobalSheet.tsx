import { useQuickLog } from "../context/QuickLogContext";
import { QuickLog } from "./QuickLog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

/**
 * The "+" tab's entry point when there's no Pursuit already in view (see
 * BottomTabBar.tsx) — same QuickLog core every Pursuit page already embeds
 * inline, just opened as a bottom sheet instead, since there's no page
 * underneath it to embed into. Mounted once, next to CartDrawer, so any
 * "+"-style control anywhere in the app can open it through QuickLogContext
 * without needing its own copy.
 */
export function QuickLogGlobalSheet() {
  const { open, closeQuickLog } = useQuickLog();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeQuickLog()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        <SheetHeader>
          <SheetTitle style={{ fontFamily: "var(--font-serif)" }}>New Moment</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          {open && <QuickLog autoFocus onDone={closeQuickLog} compact={false} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
