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
import { Stubby, type StubbyState } from "../../components/stubby/Stubby";
import { Reveal } from "../../components/afterhours/Reveal";
import { GroupRows } from "../../components/pursuit/GroupRows";
import { NextTogetherCard } from "../../components/pursuit/NextTogetherCard";
import { MakeItAPursuitSheet } from "../../components/pursuit/MakeItAPursuitSheet";
import { Confetti } from "../../components/pursuit/Confetti";
import type { Measure, PursuitMember, ProgressEntry } from "../../lib/journal";
import { plural } from "../../lib/plural";
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

const STUBBY_STATES: StubbyState[] = [
  "idle", "stamped", "unstamped", "yours", "shrug", "torn", "rejoined", "tilt",
  "arrived", "knock", "checkedIn", "done", "letGo", "sleep", "thinking", "cool",
];
type StubbyTone = "platform" | "cobalt" | "navy";

/** Stubby at 360px with every reaction on a button, the mark at 44 and 28px, and a background switch. */
function StubbyKit() {
  const [state, setState] = useState<StubbyState>("idle");
  const [tone, setTone] = useState<StubbyTone>("platform");
  const [pokes, setPokes] = useState(0);
  // Pressing the state that is already showing plays it again: step through idle first.
  const play = (next: StubbyState) => {
    setState("idle");
    setTimeout(() => setState(next), 60);
  };
  const dark = tone !== "platform";
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Background"
        value={tone}
        onChange={setTone}
        options={[
          { value: "platform", label: "Platform" },
          { value: "cobalt", label: "Cobalt" },
          { value: "navy", label: "Navy" },
        ]}
      />
      <div className="soosh-transfer flex flex-col items-center gap-6 rounded-card p-6" data-tone={tone}>
        <Stubby state={state} size={360} onDark={dark} followPointer label="Stubby" onPoke={() => setPokes((n) => n + 1)} />
        <div className="flex items-end gap-6">
          <Stubby size={44} onDark={dark} />
          <Stubby size={28} onDark={dark} />
          <p className="text-small transfer-muted">{`Poked ${plural(pokes, "time")}`}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {STUBBY_STATES.map((s) => (
          <PillButton key={s} variant={s === state ? "primary" : "outline"} onClick={() => play(s)}>
            {s}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-[family-name:var(--font-display)] text-title font-bold">{title}</h2>
      {children}
    </section>
  );
}

const GROUP: PursuitMember[] = [
  { userId: "u1", displayName: "Priya Nair", status: "joined", role: "owner" },
  { userId: "u2", displayName: "Sneha Rao", status: "joined", role: "member" },
  { userId: "u3", displayName: "Arjun Mehta", status: "joined", role: "member" },
  { userId: "u4", displayName: "Dev Patel", status: "joined", role: "member" },
];
const GROUP_MEASURE = { kind: "count", target: 5, unit: "times", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 } as Measure;
const GROUP_DONE: Record<string, number> = { u1: 3, u2: 2, u3: 0, u4: 1 };
const entriesFor = (m: PursuitMember): ProgressEntry[] =>
  Array.from({ length: GROUP_DONE[m.userId ?? ""] ?? 0 }, (_, i) => ({ id: `${m.userId}-${i}`, projectId: "kit", userId: m.userId, amount: 1, createdAt: i }));

export function DevKit() {
  const [moods, setMoods] = useState<string[]>(["Move"]);
  const [who, setWho] = useState<"open" | "friends" | "solo">("open");
  const [goal, setGoal] = useState(5);
  const [joined, setJoined] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [big, setBig] = useState(false);
  const [pursuitSheet, setPursuitSheet] = useState(false);
  const [confetti, setConfetti] = useState(0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 pb-24">
      <Reveal>
        <h1 className="font-[family-name:var(--font-display)] text-display font-extrabold">Component kit</h1>
        <p className="mt-1 text-body text-muted-foreground">Every foundation component and motion token. Development only.</p>
      </Reveal>

      <Section title="Stubby">
        <StubbyKit />
      </Section>

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

      <Section title="Pursuit page pieces">
        <NextTogetherCard pursuitId="kit" userId="kit-user" isOwner />
        <GroupRows
          members={GROUP}
          requests={[{ userId: "u5", displayName: "Kavya Iyer", status: "requested", role: "member" }]}
          measure={GROUP_MEASURE}
          entriesOf={entriesFor}
          viewerId="u2"
          onAnswer={() => undefined}
        />
        <div className="flex flex-wrap gap-3">
          <PillButton onClick={() => setPursuitSheet(true)}>Make it a Pursuit</PillButton>
          <PillButton variant="outline" onClick={() => setConfetti((c) => c + 1)}>
            Confetti
          </PillButton>
        </div>
        {confetti > 0 && <Confetti key={confetti} />}
        <MakeItAPursuitSheet open={pursuitSheet} onOpenChange={setPursuitSheet} corner={{ spaceSlug: "food-cooking", slug: "pasta", name: "Pasta" }} />
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
