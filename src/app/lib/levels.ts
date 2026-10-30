/**
 * Levels, earned from the number of Stubs. The same thresholds live in the
 * database (private.level_for) so a private profile can show a level name
 * without sending its Stub count; levels.test.ts pins both ends.
 */
export interface Level {
  /** 1 to 8. */
  index: number;
  name: string;
  /** Stubs needed to reach it. */
  stubs: number;
}

export const LEVELS: readonly Level[] = [
  { index: 1, name: "Just Getting Started", stubs: 0 },
  { index: 2, name: "First Step", stubs: 1 },
  { index: 3, name: "Out & About", stubs: 3 },
  { index: 4, name: "Weekend Regular", stubs: 7 },
  { index: 5, name: "Plan Maker", stubs: 10 },
  { index: 6, name: "Good Company", stubs: 20 },
  { index: 7, name: "Neighborhood Regular", stubs: 35 },
  { index: 8, name: "Local Legend", stubs: 50 },
];

interface LevelProgress {
  index: number;
  name: string;
  current: Level;
  /** Null at the top level. */
  next: Level | null;
  stubsToNext: number;
  /** 0 to 1; 1 at the top level. */
  progress: number;
}

export function getLevel(stubCount: number): LevelProgress {
  const n = Math.max(0, Math.floor(stubCount));
  let at = 0;
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].stubs <= n) at = i;
  const current = LEVELS[at];
  const next = LEVELS[at + 1] ?? null;
  if (!next) return { index: current.index, name: current.name, current, next: null, stubsToNext: 0, progress: 1 };
  return {
    index: current.index,
    name: current.name,
    current,
    next,
    stubsToNext: next.stubs - n,
    progress: (n - current.stubs) / (next.stubs - current.stubs),
  };
}
