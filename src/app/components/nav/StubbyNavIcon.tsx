import { Stubby } from "../stubby/Stubby";

/** Stubby's width on the rail: the same visual size as the 24px Lucide icons beside it. */
export const STUBBY_NAV_SIZE = 22;

/**
 * Calendar's icon: the Stubby mark (Stubby below 56px: eyes only, no reactions). No new artwork.
 * Inactive it is an outline in `currentColor`, like the Lucide icons beside it, with the coral
 * body off; on the page it belongs to (its link has aria-current="page") it is the full coral
 * mark. The colours switch in theme.css (.stubby-nav-icon), so hover follows the rail's own.
 * Decorative: the link's label is its name. Takes the Lucide props it is given and ignores them.
 */
export function StubbyNavIcon({ className }: { className?: string; strokeWidth?: number | string; "aria-hidden"?: boolean | "true" | "false" }) {
  return (
    <span className={`stubby-nav-icon inline-flex items-center justify-center ${className ?? ""}`} data-stubby-nav-icon="" aria-hidden="true">
      <Stubby size={STUBBY_NAV_SIZE} />
    </span>
  );
}
