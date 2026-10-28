import { Link } from "react-router";
import { Search } from "lucide-react";
import { motion } from "motion/react";
import { PAGE_FROM, PAGE_TO, page, press, PRESS_SCALE } from "../../lib/motionTokens";

const MotionLink = motion.create(Link);

/**
 * "This week in" over the city (Bricolage), a search button on the right.
 * Tapping the city opens the sheet that changes what you want more of and
 * where you are. With no city yet the title stands alone.
 */
export function DiscoverHeader({ city, onEdit }: { city: string; onEdit: () => void }) {
  return (
    <motion.header initial={PAGE_FROM} animate={PAGE_TO} transition={page} className="flex items-start justify-between gap-4">
      <button type="button" onClick={onEdit} className="min-h-11 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block text-body text-muted-foreground">This week{city ? " in" : ""}</span>
        <h1 className="font-[family-name:var(--font-display)] text-display leading-tight font-extrabold">{city || "Discover"}</h1>
      </button>
      <MotionLink
        to="/search"
        aria-label="Search"
        whileTap={{ scale: PRESS_SCALE }}
        transition={press}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground"
      >
        <Search className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </MotionLink>
    </motion.header>
  );
}
