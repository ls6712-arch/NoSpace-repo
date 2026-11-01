import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { stubbyNudgeEnabled } from "../../config";
import { ASK_COPY, DOCK_COPY } from "../../lib/calendarCopy";
import { page, sheet } from "../../lib/motionTokens";
import { captureOpener, restoreFocus } from "../../lib/returnFocus";
import { asksLeft as readAsksLeft } from "../../lib/stubbyAsk";
import { useMediaQuery } from "../../lib/useMediaQuery";
import {
  NUDGE_DELAY_MS,
  NUDGE_SHOW_MS,
  canNudge,
  nudgePage,
  readNudgeDay,
  showStubbyDock,
  takeHello,
  useFullSheetOpen,
  writeNudgeDay,
} from "../../lib/stubbyDock";
import { BottomSheet } from "../ui/BottomSheet";
import { AskStubby } from "./AskStubby";
import { StubbyBuddy } from "./StubbyBuddy";
import { useStubbyDock } from "./StubbyDockContext";

/** Stubby's width in the dock. 56px is the smallest size that still reacts (below it he is the mark). */
const DOCK_STUBBY = 60;
/** A hover or focus hop at most this often, so a wandering pointer doesn't keep him bouncing. */
const EAGER_GAP_MS = 1500;

/**
 * Stubby in the corner of every main signed-in page (showStubbyDock). Tapping him opens
 * Ask Stubby: a bottom sheet on a phone, a side panel from 1128px. He never talks. He
 * rests smiling (`ready`), says hello once a session, hops when hovered or focused,
 * lights up when the panel opens, thinks while an ask runs, then stamps, shrugs or tilts
 * and settles back to smiling.
 */
export function StubbyDock() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const fullSheet = useFullSheetOpen();
  const visible = showStubbyDock(pathname, !!user) && !fullSheet;
  const dock = useStubbyDock();
  const { open, setOpen, buddy, busy, setBusy, asksLeft, setAsksLeft } = dock;
  const reduce = useReducedMotion() ?? false;
  const desk = useMediaQuery("(min-width: 1128px)");
  const tab = useMediaQuery("(min-width: 744px)");
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const button = useRef<HTMLButtonElement | null>(null);

  // Leaving the dock's pages closes the panel.
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible, setOpen]);

  // Asks left today, for the nudge, before the panel has ever opened.
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !visible || asksLeft !== null) return;
    let live = true;
    void readAsksLeft().then((n) => {
      if (live) setAsksLeft(n);
    });
    return () => {
      live = false;
    };
  }, [userId, visible, asksLeft, setAsksLeft]);

  // Hello, once a session: a hop and one soft ring.
  const [ring, setRing] = useState(false);
  useEffect(() => {
    if (!visible || !takeHello()) return;
    buddy.current?.react("hello");
    if (!reduce) setRing(true);
  }, [visible, buddy, reduce]);

  const lastEager = useRef(0);
  const eager = () => {
    if (open || busy || Date.now() - lastEager.current < EAGER_GAP_MS) return;
    lastEager.current = Date.now();
    buddy.current?.react("eager");
  };

  const openPanel = () => {
    setNudge(false);
    setOpen(true);
  };
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) buddy.current?.react("excited");
    wasOpen.current = open;
  }, [open, buddy]);

  // The nudge: once a New York day, on Home or Calendar, from 744px wide (on a phone the
  // caption would sit over the page). A caption beside Stubby, never his speech.
  const [nudge, setNudge] = useState(false);
  const asksLeftRef = useRef(asksLeft);
  asksLeftRef.current = asksLeft;
  const openRef = useRef(open);
  openRef.current = open;
  const nudgeAllowed = stubbyNudgeEnabled && visible && tab && nudgePage(pathname);
  useEffect(() => {
    if (!nudgeAllowed) return;
    const t = window.setTimeout(() => {
      if (!canNudge({ lastShown: readNudgeDay(), now: Date.now(), asksLeft: asksLeftRef.current, panelOpen: openRef.current })) return;
      writeNudgeDay(Date.now());
      setNudge(true);
      buddy.current?.react("peek");
    }, NUDGE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [nudgeAllowed, pathname, buddy]);
  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => setNudge(false), NUDGE_SHOW_MS);
    return () => window.clearTimeout(t);
  }, [nudge]);
  const showNudge = nudge && nudgeAllowed && !open && asksLeft !== 0;

  if (!visible) return null;

  // With the side panel open he steps left of it and above its scrim, so he thinks and
  // reacts beside the panel. On a phone the sheet covers him until it closes.
  const beside = desk && open;
  const panel = (
    <AskStubby variant="panel" autoFocus={desk} onBusy={setBusy} onReact={(r) => buddy.current?.react(r)} onAsksLeft={setAsksLeft} />
  );

  return (
    <>
      <div
        data-stubby-dock=""
        style={beside ? { right: "calc(400px + 24px)", zIndex: 51 } : undefined}
        className="fixed bottom-[calc(72px+var(--safe-bottom)+12px)] right-[calc(16px+var(--safe-right))] z-40 flex items-center gap-2 rail:bottom-6 rail:right-6 desk:bottom-6 desk:right-6"
      >
        <AnimatePresence>
          {showNudge && (
            <motion.div
              key="nudge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={page}
              className="flex items-center rounded-full border border-border bg-card pl-1 text-foreground shadow-overlay"
            >
              <button type="button" onClick={openPanel} className="min-h-11 rounded-full px-3 text-small font-semibold">
                {DOCK_COPY.nudge}
              </button>
              <button
                type="button"
                onClick={() => setNudge(false)}
                aria-label={DOCK_COPY.dismiss}
                className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          ref={button}
          type="button"
          aria-label={DOCK_COPY.button}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openPanel())}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") eager();
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) eager();
          }}
          className="relative flex size-16 shrink-0 items-end justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* His ground: a soft oval he stands on, so he reads as a character, not an app icon. */}
          <span aria-hidden="true" className="absolute bottom-2 left-1/2 h-2.5 w-12 -translate-x-1/2 rounded-full bg-[var(--stubby-ink)] opacity-20 blur-[2px]" />
          {ring && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ ...page, duration: page.duration * 3 }}
              onAnimationComplete={() => setRing(false)}
            />
          )}
          <StubbyBuddy ref={buddy} size={DOCK_STUBBY} rest="ready" waiting={busy} followPointer={finePointer} className="relative mb-1.5" />
        </button>
      </div>

      {desk ? (
        <SidePanel open={open} onOpenChange={setOpen}>
          {panel}
        </SidePanel>
      ) : (
        <BottomSheet open={open} onOpenChange={setOpen} title={ASK_COPY.title} focusContent>
          {panel}
        </BottomSheet>
      )}
    </>
  );
}

/** From 1128px: a 400px panel on the right, the full height of the window, over a scrim. */
function SidePanel({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={page}
                className="fixed inset-0 z-50 bg-scrim-solid/40"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onOpenAutoFocus={() => {
                opener.current = captureOpener();
              }}
              onCloseAutoFocus={(e) => {
                if (restoreFocus(opener.current)) e.preventDefault();
              }}
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={sheet}
                className="fixed inset-y-0 right-0 z-50 flex w-[400px] max-w-full flex-col border-l border-border bg-card text-foreground shadow-overlay outline-none"
                style={{ paddingTop: "var(--safe-top)", paddingRight: "var(--safe-right)", paddingBottom: "var(--safe-bottom)" }}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
                  <Dialog.Title className="font-[family-name:var(--font-display)] text-title font-bold">{ASK_COPY.title}</Dialog.Title>
                  <Dialog.Description className="sr-only">{ASK_COPY.title}</Dialog.Description>
                  <Dialog.Close aria-label="Close" className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                    <X className="size-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
