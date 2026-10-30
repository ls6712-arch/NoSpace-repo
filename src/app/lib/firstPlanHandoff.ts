import type { SharedHalf } from "./firstPlanRemote";

/**
 * What screen 11 hands to screen 12: the link to the other half. Kept for the
 * tab only (sessionStorage), per person, so a reload on the invite screen still
 * has it and a different account on the same tab never sees it.
 */
const KEY = "soosh.firstPlan.half";

export function saveHalf(userId: string, half: SharedHalf): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ userId, half }));
  } catch {
    // Without storage the invite screen just has nothing to send.
  }
}

export function readHalf(userId: string | undefined): SharedHalf | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw || !userId) return null;
    const v = JSON.parse(raw) as { userId?: string; half?: SharedHalf };
    return v.userId === userId && v.half?.url ? v.half : null;
  } catch {
    return null;
  }
}

export function clearHalf(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
