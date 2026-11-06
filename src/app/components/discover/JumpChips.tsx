import { useEffect, useRef, useState } from "react";
import { Chip } from "../ui/Chip";
import { usePrefersReducedMotion } from "../../lib/useReducedMotion";

export const JUMP_SECTIONS = [
  { id: "discover-stubby", label: "Stubby" },
  { id: "discover-ideas", label: "Ideas" },
  { id: "discover-corners", label: "Corners" },
  { id: "discover-resources", label: "Resources" },
  { id: "discover-pursuit-ideas", label: "Pursuit ideas" },
  { id: "discover-spaces", label: "Spaces" },
  { id: "discover-people", label: "People" },
  { id: "discover-moments", label: "Moments" },
] as const;

/** Sections only a signed-in person has. */
const SIGNED_IN_ONLY = new Set<string>(["discover-stubby", "discover-people", "discover-moments"]);

/**
 * Each chip scrolls to its section on the same page. Not tabs. A visitor has no Stubby, People or
 * Moments section, so no chip for them. A section left out because it is empty hides its chip too.
 */
export function JumpChips({ signedIn = true }: { signedIn?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const nav = useRef<HTMLElement>(null);
  // Which sections are on the page right now: they load and drop out on their own.
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set(JUMP_SECTIONS.map((s) => s.id)));
  useEffect(() => {
    const page = nav.current?.parentElement;
    if (!page) return;
    const check = () => {
      const next = new Set(JUMP_SECTIONS.map((s) => s.id).filter((id) => document.getElementById(id)));
      setPresent((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
    };
    check();
    const watch = new MutationObserver(check);
    watch.observe(page, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);
  return (
    <nav ref={nav} aria-label="Sections" className="flex flex-wrap gap-2 py-1">
      {JUMP_SECTIONS.filter((s) => (signedIn || !SIGNED_IN_ONLY.has(s.id)) && present.has(s.id)).map((s) => (
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
