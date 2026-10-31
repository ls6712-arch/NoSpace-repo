import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { PRESS_SCALE, press } from "../../lib/motionTokens";

/**
 * A choice on the taste screens (theme.css `.ob-chip`): a real button
 * with `aria-pressed`, an empty dot when off and a signal dot when on.
 * `sub` is a second line under the label ("Mia’s going").
 */
export function ChoiceChip({
  children,
  sub,
  pressed,
  onToggle,
}: {
  children: ReactNode;
  sub?: ReactNode;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button type="button" className="ob-chip" aria-pressed={pressed} onClick={onToggle} whileTap={{ scale: PRESS_SCALE }} transition={press}>
      <span className="ob-chip-dot" aria-hidden="true">
        {pressed && <Check className="size-3" strokeWidth={4} />}
      </span>
      <span className="min-w-0 break-words">
        {children}
        {sub && <span className="ob-chip-sub">{sub}</span>}
      </span>
    </motion.button>
  );
}
