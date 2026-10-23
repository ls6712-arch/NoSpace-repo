/** Half-life decay: 1 now, 0.5 after `halfLife` (same unit as `t`), toward 0. */
export function decay(t: number, halfLife: number): number {
  return Math.pow(0.5, Math.max(0, t) / halfLife);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Turns a sum of weighted events into 0 to 1 with diminishing returns: 1 - exp(-x / scale). */
export function squash(x: number, scale = 6): number {
  return 1 - Math.exp(-Math.max(0, x) / scale);
}

export const DAY_MS = 24 * 3_600_000;

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
