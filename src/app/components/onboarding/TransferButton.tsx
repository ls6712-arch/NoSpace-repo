import type { ReactNode } from "react";
import { motion } from "motion/react";
import { PRESS_SCALE, press } from "../../lib/motionTokens";

/**
 * The onboarding primary button (Transfer look, theme.css `.transfer-button`).
 * When it is disabled the label says what is missing ("Pick 2 more"), so pass
 * that as the children rather than leaving the usual label on a faded button.
 */
export function TransferButton({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      className="transfer-button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: PRESS_SCALE, y: 3 }}
      transition={press}
    >
      {children}
    </motion.button>
  );
}
