import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ITEM_MAX, type ListItem } from "../../lib/startList";
import { pop } from "../../lib/motionTokens";
import { cn } from "../ui/utils";

/**
 * "What you'll need": the person's own list. A tick means "got it". The
 * Corner's needs are only where it starts; add a row or remove any row.
 */
export function NeedsList({
  items,
  onToggle,
  onAdd,
  onRemove,
  onShare,
  className,
}: {
  items: readonly ListItem[];
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  onShare: () => void;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const submit = () => {
    if (text.trim()) onAdd(text);
    setText("");
    setAdding(false);
  };
  return (
    <section aria-labelledby="start-needs" className={cn("mt-8", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="start-needs" className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
          What you’ll need
        </h2>
        {items.length > 0 && (
          <button type="button" onClick={onShare} className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
            Share list
          </button>
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.li key={i.id} layout exit={{ opacity: 0 }} transition={pop} className="flex items-center gap-1 rounded-control border border-border bg-card">
              <button
                type="button"
                role="checkbox"
                aria-checked={i.got}
                onClick={() => onToggle(i.id)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left text-body"
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", i.got ? "border-accent bg-accent text-accent-foreground" : "border-border")} aria-hidden="true">
                  {i.got && (
                    <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={pop} className="flex">
                      <Check className="size-4" strokeWidth={2.5} />
                    </motion.span>
                  )}
                </span>
                <span className={cn("min-w-0 flex-1", i.got && "text-muted-foreground")}>{i.text}</span>
              </button>
              <button type="button" aria-label={`Remove ${i.text}`} onClick={() => onRemove(i.id)} className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
                <X className="size-4" aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {adding ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            aria-label="Add something you need"
            value={text}
            maxLength={ITEM_MAX}
            onChange={(e) => setText(e.target.value)}
            onBlur={submit}
            className="min-h-11 w-full rounded-control border border-border bg-card px-3 text-body text-foreground"
          />
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-accent-text underline-offset-4 hover:underline">
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      )}
    </section>
  );
}
