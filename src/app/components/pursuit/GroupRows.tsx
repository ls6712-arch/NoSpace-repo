import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { PillButton } from "../ui/PillButton";
import type { Measure, PursuitMember, ProgressEntry } from "../../lib/journal";
import { formatAmount, summarize } from "../../lib/pursuitProgress";
import { PAGE_FROM, PAGE_TO, page, staggerDelay } from "../../lib/motionTokens";

const HUES = ["rose", "orange", "violet", "blue", "lime", "teal", "pink"] as const;

/** One of the category colours for a person, the same every time. */
export function personHue(key: string): (typeof HUES)[number] {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return HUES[n % HUES.length];
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

/**
 * "The group" (screen 5): a row per person with their avatar, "1 of 5" and a
 * 4px bar in their own colour that grows in from nothing. The order is the order
 * people joined, never by progress, and there are no ranks or comparisons.
 * The host also sees people waiting to join, with Let in and Not now.
 */
export function GroupRows({
  members,
  requests = [],
  measure,
  entriesOf,
  viewerId,
  onAnswer,
}: {
  members: readonly PursuitMember[];
  requests?: readonly PursuitMember[];
  measure: Measure;
  entriesOf: (m: PursuitMember) => ProgressEntry[];
  viewerId?: string;
  onAnswer?: (member: PursuitMember, accept: boolean) => void;
}) {
  return (
    <section aria-labelledby="group-title" className="mb-6">
      <h2 id="group-title" className="mb-3 font-[family-name:var(--font-display)] text-title font-bold">
        The group
      </h2>
      <ul className="flex flex-col gap-4">
        {members.map((m, i) => {
          const key = m.userId ?? m.displayName;
          const s = summarize(measure, entriesOf(m), m.role === "owner");
          const hue = `var(--cat-${personHue(key)})`;
          const name = m.userId && m.userId === viewerId ? "You" : m.displayName;
          return (
            <motion.li
              key={key}
              initial={PAGE_FROM}
              animate={PAGE_TO}
              transition={{ ...page, delay: staggerDelay(i) }}
              className="flex items-center gap-3"
            >
              <Avatar className="size-11">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback className="text-body font-semibold text-[var(--ink)]" style={{ background: hue }}>
                  {initial(m.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-body">{name}</p>
                  <p className="shrink-0 text-small text-muted-foreground tabular-nums">
                    {`${formatAmount(Math.min(s.current, s.target))} of ${formatAmount(s.target)}`}
                  </p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10" role="presentation">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{ background: hue }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: s.fraction }}
                    transition={{ ...page, delay: 0.15 + staggerDelay(i), duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {requests.length > 0 && onAnswer && (
        <ul className="mt-6 flex flex-col gap-3" aria-label="Waiting to join">
          {requests.map((m) => (
            <li key={m.userId ?? m.displayName} className="flex items-center gap-3 rounded-card bg-card p-3">
              <Avatar className="size-10">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback className="text-small font-semibold text-[var(--ink)]" style={{ background: `var(--cat-${personHue(m.userId ?? m.displayName)})` }}>
                  {initial(m.displayName)}
                </AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 truncate text-small">{m.displayName}</p>
              <PillButton variant="outline" className="px-4" onClick={() => onAnswer(m, false)}>
                Not now
              </PillButton>
              <PillButton className="px-4" onClick={() => onAnswer(m, true)}>
                Let in
              </PillButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
