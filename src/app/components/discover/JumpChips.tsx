import { Chip } from "../ui/Chip";
import { usePrefersReducedMotion } from "../../lib/useReducedMotion";

export const JUMP_SECTIONS = [
  { id: "discover-ideas", label: "Ideas" },
  { id: "discover-corners", label: "Corners" },
  { id: "discover-spaces", label: "Spaces" },
  { id: "discover-moments", label: "Moments" },
] as const;

/** Each chip scrolls to its section on the same page. Not tabs. A visitor has no Moments section, so no chip for it. */
export function JumpChips({ withMoments = true }: { withMoments?: boolean }) {
  const reduced = usePrefersReducedMotion();
  return (
    <nav aria-label="Sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:-mx-8 md:px-8 [scrollbar-width:none]">
      {JUMP_SECTIONS.filter((s) => withMoments || s.id !== "discover-moments").map((s) => (
        <Chip
          key={s.id}
          aria-pressed={undefined}
          className="shrink-0 border border-border"
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })}
        >
          {s.label}
        </Chip>
      ))}
    </nav>
  );
}
