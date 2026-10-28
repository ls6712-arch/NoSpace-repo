import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { Ticket } from "../stub/Ticket";
import { PillButton } from "../ui/PillButton";
import { cornerColor } from "../../lib/categoryStyle";
import type { StubCard } from "../../lib/stubs";
import { SITE_ORIGIN } from "../../config";
import { shared } from "../../lib/motionTokens";

export const stubLayoutId = (id: number) => `stub-${id}`;
export const stubColor = (c: StubCard) => (c.corner ? `var(--cat-${cornerColor(c.corner.spaceSlug, c.corner.slug)})` : "var(--cat-orange)");

/** One Stub full screen. The tile grew into it on the `shared` spring; Share sends a line and a link. */
export function StubViewer({ stub, onClose }: { stub: StubCard; onClose: () => void }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    const text = `${stub.title} on Soosh. ${stub.meta}`.trim();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: stub.title, text, url: SITE_ORIGIN });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${SITE_ORIGIN}`);
      setNote("Link copied");
    } catch {
      // a cancelled share sheet is not an error
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={stub.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shared}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-4"
    >
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-card">
        <X className="size-5" aria-hidden="true" />
      </button>
      <div className="w-full max-w-sm">
        <Ticket
          layoutId={stubLayoutId(stub.id)}
          variant={stub.kind}
          serial={stub.serial ?? undefined}
          title={stub.title}
          meta={stub.meta}
          count={stub.count}
          color={stubColor(stub)}
          className="min-h-40"
        />
        <div className="mt-5 flex items-center justify-center gap-3">
          <PillButton onClick={() => void share()}>Share</PillButton>
          <span role="status" className="text-small text-muted-foreground">
            {note}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
