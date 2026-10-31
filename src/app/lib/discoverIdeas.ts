import type { IdeaSpend, IdeaTime, IdeaWho } from "../data/cornerIdeas";
import type { Taste } from "./tasteRemote";
import { windowsLeft } from "./homeWeek";
import { passLine } from "./homeReasons";
import type { IdeaPills } from "./ideaMatch";
import { isPassKind, type Pass, type PassKind } from "./tasteModel";

/**
 * The logic behind "What could you do?" that is not the matching itself
 * (ideaMatch.ts): where the pills start, how a tap changes one, and which pass
 * tag an idea gets. Pure. Nothing here is saved to the profile.
 */

export const WHO_ORDER: readonly IdeaWho[] = ["solo", "friend", "new"];

/**
 * Time from the next free window the person saved: an evening is Tonight, a day
 * that is free all day (daytime and evening) is Weekend, no windows at all is
 * Tonight. A free daytime window on its own reads as Tonight too, since all
 * day is the only case that asks for a longer stretch. Spend from the monthly
 * budget: 0 is Free, anything else (or none saved) is Under $25. Who starts at
 * A friend.
 */
export function defaultPills(taste: Pick<Taste, "windows" | "budget"> | null, now: number): IdeaPills {
  const left = taste ? windowsLeft(taste.windows, now) : [];
  const next = left[0];
  let time: IdeaTime = "tonight";
  if (next && next.slot === "day" && left.some((w) => w.day === next.day && w.offset === next.offset && w.slot === "eve")) time = "weekend";
  const spend: IdeaSpend = taste?.budget === 0 ? "free" : "under25";
  return { time, spend, who: "friend" };
}

/** "Nothing fits that mix yet" offers this (the link Show more ideas): the same pills with Spend at Treat me. */
export const loosenSpend = (p: IdeaPills): IdeaPills => ({ ...p, spend: "treat" });

/**
 * Home's pass-to-Corner map (app_config 'home_ranking_v1', `pass_corners`), read
 * rather than copied. Kind to Corner keys.
 */
export type PassCorners = Record<string, readonly string[]>;

export function parsePassCorners(config: unknown): PassCorners {
  const raw = (config as { pass_corners?: unknown } | null)?.pass_corners;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [kind, keys] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(keys)) out[kind] = keys.filter((k): k is string => typeof k === "string");
  }
  return out;
}

/** "Your museum pass" when one of the person's passes covers this Corner, else null. */
export function passTagFor(cornerKey: string, passes: readonly Pick<Pass, "kind">[], map: PassCorners): string | null {
  const kinds = [...new Set(passes.map((p) => p.kind))].sort();
  const kind = kinds.find((k): k is PassKind => isPassKind(k) && (map[k] ?? []).includes(cornerKey));
  return kind ? passLine(kind) : null;
}
