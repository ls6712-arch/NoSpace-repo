import type { ReactNode } from "react";
import { motion } from "motion/react";
import { PRESS_SCALE, press } from "../../lib/motionTokens";

/**
 * A choice on the taste screens (theme.css `.transfer-chip`): a real button
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
    <motion.button type="button" className="transfer-chip" aria-pressed={pressed} onClick={onToggle} whileTap={{ scale: PRESS_SCALE }} transition={press}>
      <span className="transfer-chip-dot" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {children}
        {sub && <span className="transfer-chip-sub">{sub}</span>}
      </span>
    </motion.button>
  );
}
