/**
 * Which Stubs this browser has already celebrated, so a Stub a host gave you
 * plays its reveal once, the first time you open your Stubs after it lands.
 * Only the highest id is kept. Browser storage can throw or come back empty;
 * either way the worst case is one reveal too many or too few.
 */
const KEY = "soosh.stubs.seen.v1";

export function readSeen(userId: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${KEY}:${userId}`);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeSeen(userId: string, id: number): void {
  try {
    window.localStorage.setItem(`${KEY}:${userId}`, String(id));
  } catch {
    // Private mode or full storage: nothing to remember with.
  }
}

/**
 * The Stub to celebrate now: the newest Was there Stub above what this browser
 * has seen. The very first visit only records what is there, so nobody gets a
 * burst of reveals for Stubs they already know about.
 */
export function stubToReveal<T extends { id: number; kind: string }>(items: readonly T[], seen: number | null): T | null {
  if (seen == null) return null;
  return items.filter((s) => s.kind === "event" && s.id > seen).sort((a, b) => b.id - a.id)[0] ?? null;
}

export const highestId = (items: readonly { id: number }[]): number => items.reduce((m, s) => Math.max(m, s.id), 0);
