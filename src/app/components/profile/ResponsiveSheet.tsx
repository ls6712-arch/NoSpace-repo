import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

const QUERY = "(min-width: 768px)";

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/** A bottom sheet on a phone, a centered modal from 768px up. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-display)] text-title font-bold">{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          {children}
          {footer && <DialogFooter className="flex-col sm:flex-col">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} footer={footer}>
      <button
        type="button"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
        className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground focus-visible:ring-[3px] focus-visible:outline-1"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      {children}
    </BottomSheet>
  );
}
