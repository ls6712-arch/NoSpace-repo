import type { IdeaSpend, IdeaTime, IdeaWho } from "../../data/cornerIdeas";
import { WHO_ORDER } from "../../lib/discoverIdeas";
import { SPEND_ORDER, TIME_ORDER, type IdeaPills as Pills } from "../../lib/ideaMatch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export const TIME_LABEL: Record<IdeaTime, string> = { hour: "An hour", tonight: "Tonight", weekend: "Weekend" };
export const SPEND_LABEL: Record<IdeaSpend, string> = { free: "Free", under25: "Under $25", treat: "Treat me" };
export const WHO_LABEL: Record<IdeaWho, string> = { solo: "Solo", friend: "A friend", new: "New people" };

/** One pill that opens a list of its values. The label names the group and the current value. */
function Pill<T extends string>({
  group,
  value,
  options,
  labels,
  onPick,
}: {
  group: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onPick: (next: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onPick(v as T)}>
      <SelectTrigger
        aria-label={`${group}: ${labels[value]}`}
        className="h-auto min-h-11 min-w-0 flex-1 justify-center gap-1.5 rounded-full border-2 border-foreground bg-transparent px-3 py-0 text-small font-semibold data-[size=default]:h-auto [&_svg]:opacity-100"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="item-aligned" className="min-w-[var(--radix-select-trigger-width)]">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="min-h-11 text-body focus:text-foreground data-[highlighted]:text-foreground">
            {labels[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Three dropdown pills: Time, Spend and Who. Choosing a value changes the row at
 * once; nothing is saved and nothing is fetched. Time and Spend are ceilings, so
 * each list reads from the smallest to the largest.
 */
export function IdeaPills({ pills, onChange }: { pills: Pills; onChange: (next: Pills) => void }) {
  return (
    <div className="flex gap-2">
      <Pill group="Time" value={pills.time} options={TIME_ORDER} labels={TIME_LABEL} onPick={(time) => onChange({ ...pills, time })} />
      <Pill group="Spend" value={pills.spend} options={SPEND_ORDER} labels={SPEND_LABEL} onPick={(spend) => onChange({ ...pills, spend })} />
      <Pill group="Who" value={pills.who} options={WHO_ORDER} labels={WHO_LABEL} onPick={(who) => onChange({ ...pills, who })} />
    </div>
  );
}
