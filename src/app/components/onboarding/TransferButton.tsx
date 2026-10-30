import type { ReactNode } from "react";
import { motion } from "motion/react";
import { PRESS_SCALE, press } from "../../lib/motionTokens";

/**
 * The onboarding primary button (Transfer look, theme.css `.transfer-button`).
 * When it is disabled the label says what is missing ("Pick 2 more"), so pass
 * that as the children rather than leaving the usual label on a faded button.
 *
 * `onDark` is for navy screens, where the navy border and drop would vanish:
 * it takes a white border and a cobalt drop. `variant="plain"` is the white
 * fill for a quieter choice next to the primary one.
 */
export function TransferButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  onDark = false,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  onDark?: boolean;
  variant?: "primary" | "plain";
}) {
  return (
    <motion.button
      type={type}
      className="transfer-button"
      data-on-dark={onDark}
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: PRESS_SCALE, y: 3 }}
      transition={press}
    >
      {children}
    </motion.button>
  );
}
