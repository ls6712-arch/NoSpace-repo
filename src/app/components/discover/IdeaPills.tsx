import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import type { IdeaSpend, IdeaTime, IdeaWho } from "../../data/cornerIdeas";
import { nextSpend, nextTime, nextWho } from "../../lib/discoverIdeas";
import type { IdeaPills as Pills } from "../../lib/ideaMatch";
import { PRESS_SCALE, press } from "../../lib/motionTokens";

export const TIME_LABEL: Record<IdeaTime, string> = { hour: "An hour", tonight: "Tonight", weekend: "Weekend" };
export const SPEND_LABEL: Record<IdeaSpend, string> = { free: "Free", under25: "Under $25", treat: "Treat me" };
export const WHO_LABEL: Record<IdeaWho, string> = { solo: "Solo", friend: "A friend", new: "New people" };

function Pill({ group, value, onTap }: { group: string; value: string; onTap: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: PRESS_SCALE }}
      transition={press}
      aria-label={`${group}: ${value}`}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-foreground bg-transparent px-3 text-small font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="truncate">{value}</span>
      <ChevronDown className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
    </motion.button>
  );
}

/** Three pills. Tapping one moves it to its next value; nothing is saved and nothing is fetched. */
export function IdeaPills({ pills, onChange }: { pills: Pills; onChange: (next: Pills) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Pill group="Time" value={TIME_LABEL[pills.time]} onTap={() => onChange({ ...pills, time: nextTime(pills.time) })} />
      <Pill group="Spend" value={SPEND_LABEL[pills.spend]} onTap={() => onChange({ ...pills, spend: nextSpend(pills.spend) })} />
      <Pill group="Who" value={WHO_LABEL[pills.who]} onTap={() => onChange({ ...pills, who: nextWho(pills.who) })} />
    </div>
  );
}
