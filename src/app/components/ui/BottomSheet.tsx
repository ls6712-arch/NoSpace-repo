import { useEffect, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { cn } from "./utils";
import { DISMISS_OFFSET, DISMISS_VELOCITY, sheet } from "../../lib/motionTokens";
import { captureOpener, restoreFocus } from "../../lib/returnFocus";
import { markFullSheetOpen } from "../../lib/stubbyDock";

/**
 * A bottom sheet that springs up on the `sheet` token (Make it a Pursuit,
 * pickers) or, with `full`, covers the screen (Log a Moment). Drag the handle
 * or header down to close: it dismisses past 120px or a fast flick, and
 * springs back otherwise. Escape and the scrim close it too. Focus returns to
 * the button that opened it.
 *
 * Put the fixed action (the Join or Post button) in `footer` so it stays at
 * the bottom while `children` scroll.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  full = false,
  footer,
  children,
  className,
  focusContent = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  full?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Focus the sheet itself on open, not its first field, so a phone keyboard doesn't jump up over it. */
  focusContent?: boolean;
}) {
  const controls = useDragControls();
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  // A full-screen sheet covers the page, so the Stubby dock steps aside while it is open.
  useEffect(() => (open && full ? markFullSheetOpen() : undefined), [open, full]);
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
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-scrim-solid/70"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onOpenAutoFocus={(e) => {
                opener.current = captureOpener();
                if (focusContent) {
                  e.preventDefault();
                  content.current?.focus({ preventScroll: true });
                }
              }}
              onCloseAutoFocus={(e) => {
                if (restoreFocus(opener.current)) e.preventDefault();
              }}
            >
              <motion.div
                ref={content}
                tabIndex={-1}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={sheet}
                drag="y"
                dragListener={false}
                dragControls={controls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onOpenChange(false);
                }}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full flex-col bg-card text-foreground outline-none",
                  full ? "top-0 tab:max-w-md" : "max-h-[92dvh] rounded-t-card tab:max-w-md",
                  className,
                )}
              >
                <div
                  onPointerDown={(e) => controls.start(e)}
                  className="flex shrink-0 touch-none flex-col items-center gap-3 px-4 pt-[max(0.5rem,var(--safe-top,0px))] pb-2"
                >
                  <span className="h-1 w-10 rounded-full bg-foreground/25" aria-hidden="true" />
                  <div className="w-full">
                    <Dialog.Title className="font-[family-name:var(--font-display)] text-title font-bold">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="text-small text-muted-foreground">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{title}</Dialog.Description>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
                {footer && <div className="shrink-0 px-4 pt-2 pb-[max(1rem,var(--safe-bottom,0px))]">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
