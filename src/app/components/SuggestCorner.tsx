import { useState } from "react";
import { Plus } from "lucide-react";

/**
 * A Corner is scoped inside one Space, but the review pipeline behind
 * "Suggest a Space" (CategoriesContext) only knows how to approve a whole
 * new top-level Space, not attach a Corner to an existing one. Wiring this
 * into that same table would either create a stray Space by mistake or
 * silently do nothing while looking like it worked, so until Corner
 * suggestions have their own reviewed path, this stays an honest "coming
 * soon" rather than a submission that goes nowhere useful.
 */
export function SuggestCorner({ hobbyName }: { hobbyName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--hairline)] bg-transparent px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/35 hover:text-foreground"
      >
        <Plus className="size-3" />
        Suggest a Corner
      </button>
      {open && (
        <span
          role="status"
          className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2.5 text-center text-[11px] leading-relaxed text-muted-foreground shadow-md"
        >
          Coming soon for {hobbyName}. For now, use "Suggest a Space" below.
        </span>
      )}
    </span>
  );
}
