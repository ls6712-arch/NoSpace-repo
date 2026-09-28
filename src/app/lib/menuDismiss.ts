/** Whether a keydown event should close an open menu/popover — Escape
 * only, matching standard menu semantics (arrow keys navigate within it,
 * this key is for leaving it). Pulled out as its own function so the one
 * bit of real logic behind "Escape closes the bell/account menu" is
 * testable without mounting either component. */
export function isDismissKey(key: string): boolean {
  return key === "Escape";
}
