import { useState } from "react";
import { motion } from "motion/react";
import { Flame, Plus, Minus } from "lucide-react";
import { Ticket } from "../../components/stub/Ticket";
import { AvatarStack } from "../../components/ui/AvatarStack";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Chip } from "../../components/ui/Chip";
import { PillButton } from "../../components/ui/PillButton";
import { RollNumber } from "../../components/ui/RollNumber";
import { Segmented } from "../../components/ui/Segmented";
import { SnapCarousel } from "../../components/ui/SnapCarousel";
import { Reveal } from "../../components/afterhours/Reveal";
import { haptic, pop, shared } from "../../lib/motionTokens";

/**
 * Every foundation component and animation on one page, for review and for
 * recording the transitions. Served in development only (`/dev/kit`).
 */
const PEOPLE = [{ name: "Priya Nair" }, { name: "Sneha Rao" }, { name: "Arjun Mehta" }, { name: "Dev Patel" }];
const MOODS = ["Make something", "Move", "Be around people", "Learn something", "Play", "Be outside"];
const SLIDES = [
  { id: "a", color: "var(--cat-rose)", title: "Sourdough" },
  { id: "b", color: "var(--cat-orange)", title: "Pasta" },
  { id: "c", color: "var(--cat-violet)", title: "Life drawing" },
  { id: "d", color: "var(--cat-teal)", title: "Badminton" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-[family-name:var(--font-display)] text-title font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function DevKit() {
  const [moods, setMoods] = useState<string[]>(["Move"]);
  const [who, setWho] = useState<"open" | "friends" | "solo">("open");
  const [goal, setGoal] = useState(5);
  const [joined, setJoined] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [big, setBig] = useState(false);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 pb-24">
      <Reveal>
        <h1 className="font-[family-name:var(--font-display)] text-display font-extrabold">Component kit</h1>
        <p className="mt-1 text-body text-muted-foreground">Every foundation component and motion token. Development only.</p>
      </Reveal>

      <Section title="Pill buttons">
        <div className="flex flex-wrap gap-3">
          <PillButton>Do this with people</PillButton>
          <PillButton variant="light">Log pasta #2</PillButton>
          <PillButton variant="outline">See what friends are up to</PillButton>
          <PillButton variant="primary" disabled>
            Show me what to do
          </PillButton>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-accent p-4">
          <p className="mr-auto font-[family-name:var(--font-display)] text-lead font-bold text-accent-foreground">Sat 6pm, Priya’s kitchen</p>
          <PillButton
            variant="ink"
            done={joined}
            doneLabel="You’re in"
            onClick={() => {
              setJoined((j) => !j);
              haptic();
            }}
          >
            I’m in
          </PillButton>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip key={m} selected={moods.includes(m)} onClick={() => setMoods((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}>
              {m}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Segmented control">
        <Segmented
          label="Who with"
          value={who}
          onChange={setWho}
          options={[
            { value: "open", label: "Open group" },
            { value: "friends", label: "Friends" },
            { value: "solo", label: "Just me" },
          ]}
        />
      </Section>

      <Section title="Number roll">
        <div className="flex items-center gap-4">
          <PillButton variant="outline" className="px-3" aria-label="Fewer" onClick={() => setGoal((g) => Math.max(1, g - 1))}>
            <Minus className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </PillButton>
          <p className="font-[family-name:var(--font-display)] text-display font-extrabold">
            <RollNumber value={goal} />
          </p>
          <PillButton variant="outline" className="px-3" aria-label="More" onClick={() => setGoal((g) => Math.min(30, g + 1))}>
            <Plus className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </PillButton>
        </div>
      </Section>

      <Section title="Avatar stack">
        <div className="flex flex-col gap-3 rounded-card bg-card p-4">
          <AvatarStack people={PEOPLE} />
          <AvatarStack people={PEOPLE.slice(0, 2)} />
          <AvatarStack people={PEOPLE.slice(0, 3)} total={9} size="size-10" />
        </div>
      </Section>

      <Section title="Stub tickets">
        <div className="flex flex-col gap-3">
          <Ticket serial={14} title="Pasta" meta="Session 2 of 5" count={{ done: 2, total: 5 }} color="var(--cat-amber)" />
          <Ticket variant="event" serial={9} title="Clay Corner open night" meta="Confirmed by the host" count={{ done: 1, total: 1 }} color="var(--cat-orange)" />
          <Ticket variant="gold" serial={21} title="You baked 10 loaves" meta="With Priya and Sneha" count={{ done: 10, total: 10 }} />
        </div>
        <div className="flex flex-col gap-3">
          <PillButton variant="outline" className="self-start" onClick={() => setRevealKey((k) => k + 1)}>
            Replay the reveal
          </PillButton>
          <Ticket key={revealKey} reveal serial={15} title="Pasta" meta="Session 3 of 5" count={{ done: 3, total: 5 }} color="var(--cat-amber)" />
        </div>
      </Section>

      <Section title="Shared element">
        <motion.button
          type="button"
          layout
          transition={shared}
          onClick={() => setBig((b) => !b)}
          className="flex items-center justify-center rounded-card text-[var(--ink)]"
          style={{ background: "var(--cat-blue)", height: big ? 220 : 96, width: big ? "100%" : 160 }}
        >
          <motion.span layout="position" transition={shared} className="font-[family-name:var(--font-display)] text-title font-extrabold">
            {big ? "Back" : "Tap me"}
          </motion.span>
        </motion.button>
      </Section>

      <Section title="Carousel">
        <SnapCarousel
          name="kit-carousel"
          label="Corners this week"
          dots
          items={SLIDES}
          getKey={(s) => s.id}
          renderItem={(s) => (
            <div className="relative flex h-44 items-end overflow-hidden rounded-card p-4 text-[var(--ink)]" style={{ background: s.color }}>
              <Flame className="absolute top-3 right-3 size-16 rotate-[15deg] opacity-[0.22]" strokeWidth={1.75} aria-hidden="true" />
              <p className="font-[family-name:var(--font-display)] text-title font-extrabold">{s.title}</p>
            </div>
          )}
        />
      </Section>

      <Section title="Sheets">
        <div className="flex flex-wrap gap-3">
          <PillButton onClick={() => setOpen(true)}>Make it a Pursuit</PillButton>
          <PillButton variant="outline" onClick={() => setFullOpen(true)}>
            Log a Moment
          </PillButton>
        </div>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Make it a Pursuit"
          description="A small goal with an end date."
          footer={<PillButton className="w-full">Start</PillButton>}
        >
          <p className="text-body text-muted-foreground">Drag the handle down, press Escape, or tap outside to close.</p>
        </BottomSheet>
        <BottomSheet
          full
          open={fullOpen}
          onOpenChange={setFullOpen}
          title="Log a Moment"
          footer={<PillButton className="w-full">Post</PillButton>}
        >
          <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={pop} className="aspect-[4/5] rounded-card bg-[var(--surface-raised,var(--card))]" />
        </BottomSheet>
      </Section>
    </main>
  );
}
