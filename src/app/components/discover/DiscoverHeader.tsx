import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { PAGE_FROM, PAGE_TO, page } from "../../lib/motionTokens";

/**
 * "What’s out there in" over the city (Bricolage) with a chevron. Tapping it
 * opens the sheet that changes the city (the existing interests sheet). With no
 * city yet the title is just Discover and tapping it opens the same sheet.
 */
export function DiscoverHeader({ city, onEdit }: { city: string; onEdit: () => void }) {
  return (
    <motion.header initial={PAGE_FROM} animate={PAGE_TO} transition={page}>
      <button type="button" onClick={onEdit} className="min-h-11 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {city && <span className="block text-body text-muted-foreground">What’s out there in</span>}
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-display leading-tight font-extrabold">
          {city || "Discover"}
          <ChevronDown className="size-6 shrink-0 text-accent-text" strokeWidth={2.5} aria-hidden="true" />
        </h1>
      </button>
    </motion.header>
  );
}
