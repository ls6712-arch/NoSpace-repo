import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { allSubHobbies, isBrowsableCorner, subHobbyLabel, titleCaseSlug } from "../../data/hobbies";
import { useAuth } from "../../context/AuthContext";
import { SHEET } from "../../lib/calendarCopy";
import { clockOf, DEFAULT_HOUR, parseClock, partOf, planActions, planStartsAt, rangeText, slotTitle, weekdayName, type DayPart, type PlanAction } from "../../lib/calendarActions";
import type { CalendarEntry, EntryRepeat, Occurrence } from "../../lib/calendarEntries";
import { NOTE_MAX } from "../../lib/calendarEntries";
import { dateParam, dayListDate, dayListHeading, isPursuitSession, parseDateParam, shortTime, stubColor, type CalendarFreeSlot } from "../../lib/calendarView";
import { formatWeekday } from "../../lib/dates";
import { HOME_TZ, nyTimeToMs } from "../../lib/homeWeek";
import { fetchConnections, type Connection } from "../../lib/planEdits";
import { fetchTaste } from "../../lib/tasteRemote";
import type { StubCard } from "../../lib/stubs";
import type { CalendarActions } from "../../lib/useCalendarActions";
import { FREE_LABEL, goingLine, kindLine, placeLine, weekDays, type WeekPlanDetail } from "../../lib/weekView";
import type { Pass } from "../../lib/tasteModel";
import { ResponsiveSheet } from "../profile/ResponsiveSheet";
import { Ticket } from "../stub/Ticket";
import { cn } from "../ui/utils";

/** What is open. One sheet at a time. */
export type SheetState =
  | { type: "slot"; startMs: number; endMs: number }
  | { type: "plan-form"; startMs?: number; dayMs?: number }
  | { type: "plan"; plan: WeekPlanDetail }
  | { type: "free"; slot: CalendarFreeSlot }
  | { type: "block"; occurrence: Occurrence }
  | { type: "stub"; stub: StubCard }
  | { type: "pick"; slot: CalendarFreeSlot };

const ROW = "flex min-h-12 w-full items-center rounded-control border border-border bg-card px-4 text-left text-body font-semibold text-foreground";
const PRIMARY = "flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-body font-semibold text-accent-foreground disabled:opacity-50";
const FIELD = "min-h-11 w-full rounded-control border border-border bg-card px-3 text-body text-foreground";

const Label = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="text-small font-semibold text-muted-foreground">
    {children}
  </label>
);

/**
 * The calendar's sheets: the time sheet for empty hours, the plan form, and one
 * sheet for each thing you tap (a plan, free time, a block, a Stub). A bottom
 * sheet on a phone, a modal from 744px. Escape closes it.
 */
export function CalendarSheets({
  sheet,
  onClose,
  now,
  actions,
  passes,
  onBring,
  onKeep,
  onNotThis,
}: {
  sheet: SheetState | null;
  onClose: () => void;
  now: number;
  actions: CalendarActions;
  passes: readonly Pass[];
  onBring: (plan: WeekPlanDetail) => void;
  /** Stubby's pick: Keep makes it a plan, Not this swaps in the next match. */
  onKeep: (slot: CalendarFreeSlot) => void;
  onNotThis: (slot: CalendarFreeSlot) => void;
}) {
  if (!sheet) return null;
  const close = onClose;
  switch (sheet.type) {
    case "slot":
      return <TimeSheet startMs={sheet.startMs} endMs={sheet.endMs} actions={actions} onClose={close} />;
    case "plan-form":
      return <PlanForm startMs={sheet.startMs} dayMs={sheet.dayMs} now={now} actions={actions} onClose={close} />;
    case "plan":
      return <PlanSheet plan={sheet.plan} actions={actions} passes={passes} onBring={onBring} onClose={close} />;
    case "free":
      return <FreeSheet slot={sheet.slot} actions={actions} onClose={close} />;
    case "block":
      return <BlockSheet occurrence={sheet.occurrence} actions={actions} onClose={close} />;
    case "stub":
      return <StubSheet stub={sheet.stub} onClose={close} />;
    case "pick":
      return <PickSheet slot={sheet.slot} onKeep={onKeep} onNotThis={onNotThis} onClose={close} />;
  }
}

// ---------- empty hours ----------

type Step = "menu" | "free" | "block";

function TimeSheet({ startMs, endMs, actions, onClose }: { startMs: number; endMs: number; actions: CalendarActions; onClose: () => void }) {
  const [step, setStep] = useState<Step>("menu");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<"plan" | null>(null);
  const day = weekdayName(startMs);
  const range = { startMs, endMs };
  const done = () => onClose();
  if (open === "plan") return <PlanForm startMs={startMs} now={Date.now()} actions={actions} onClose={onClose} />;
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={step === "menu" ? slotTitle(startMs) : step === "free" ? SHEET.imFree : SHEET.blockThis}>
      <p className="mb-4 text-small text-muted-foreground">{rangeText(startMs, endMs)}</p>
      {step === "menu" && (
        <div className="flex flex-col gap-2">
          <button type="button" className={PRIMARY} onClick={() => setOpen("plan")}>
            {SHEET.makePlanAt(shortTime(startMs))}
          </button>
          <button type="button" className={ROW} onClick={() => setStep("free")}>
            {SHEET.imFree}
          </button>
          <button type="button" className={ROW} onClick={() => setStep("block")}>
            {SHEET.blockThis}
          </button>
        </div>
      )}
      {step === "free" && (
        <div className="flex flex-col gap-2">
          <button type="button" className={ROW} onClick={() => void actions.addFree(range, "none").then((ok) => ok && done())}>
            {SHEET.justThis(day)}
          </button>
          <button type="button" className={ROW} onClick={() => void actions.addFree(range, "weekly").then((ok) => ok && done())}>
            {SHEET.every(day)}
          </button>
        </div>
      )}
      {step === "block" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="block-note">{SHEET.note}</Label>
            <input id="block-note" className={FIELD} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
            <span className="text-caption text-muted-foreground">{SHEET.noteHint}</span>
          </div>
          <button type="button" className={ROW} onClick={() => void actions.addBlock(range, "none", note).then((ok) => ok && done())}>
            {SHEET.once}
          </button>
          <button type="button" className={ROW} onClick={() => void actions.addBlock(range, "weekly", note).then((ok) => ok && done())}>
            {SHEET.everyWeek}
          </button>
        </div>
      )}
      {step !== "menu" && (
        <button type="button" onClick={() => setStep("menu")} className="mt-3 inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
          {SHEET.back}
        </button>
      )}
    </ResponsiveSheet>
  );
}

// ---------- make a plan ----------

const DAYS_OFFERED = 14;

/** Corners to pick from: the person's picked ones first, then a search over all of them. */
function useCornerChoices(userId: string | undefined, query: string) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void fetchTaste(userId).then((t) => live && setPicked(t.picks));
    return () => {
      live = false;
    };
  }, [userId]);
  const name = (key: string) => {
    const slug = key.split("/")[1] ?? key;
    return subHobbyLabel(slug) ?? titleCaseSlug(slug);
  };
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const yours = picked.map((key) => ({ key, name: name(key) }));
    if (!q) return { yours, found: [] as { key: string; name: string }[] };
    const seen = new Set<string>();
    const found = allSubHobbies
      .filter((s) => isBrowsableCorner(s.hobbySlug, s.slug) && s.label.toLowerCase().includes(q) && !seen.has(s.slug) && !!seen.add(s.slug))
      .slice(0, 8)
      .map((s) => ({ key: `${s.hobbySlug}/${s.slug}`, name: s.label }));
    return { yours: yours.filter((c) => c.name.toLowerCase().includes(q)), found };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, query]);
}

function PlanForm({ startMs, dayMs, now, actions, onClose }: { startMs?: number; dayMs?: number; now: number; actions: CalendarActions; onClose: () => void }) {
  const { user } = useAuth();
  const days = useMemo(() => weekDays(now, DAYS_OFFERED), [now]);
  const first = startMs ?? dayMs;
  const [day, setDay] = useState(first ? dateParam(first) : dateParam(now));
  const [part, setPart] = useState<DayPart>(startMs ? partOf(startMs) : "eve");
  const [exact, setExact] = useState(startMs ? clockOf(startMs) : "");
  const [query, setQuery] = useState("");
  const [corner, setCorner] = useState<{ key: string; name: string } | null>(null);
  const [friends, setFriends] = useState<Connection[]>([]);
  const [friendId, setFriendId] = useState("");
  const [busy, setBusy] = useState(false);
  const choices = useCornerChoices(user?.id, query);
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    void fetchConnections(user.id).then((c) => live && setFriends(c));
    return () => {
      live = false;
    };
  }, [user?.id]);

  const dayMsValue = parseDateParam(day) ?? now;
  const chosenDay = weekDays(dayMsValue, 1)[0];
  const exactBad = exact !== "" && !parseClock(exact);
  const at = planStartsAt(chosenDay, part, exact);
  const past = at <= now;
  const dayOptions = days.some((d) => dateParam(d.noonMs) === day) ? days : [...weekDays(dayMsValue, 1), ...days];
  const title = startMs ? SHEET.makePlanAt(shortTime(startMs)) : SHEET.makePlan;

  const submit = async () => {
    if (!corner || busy || exactBad || past) return;
    setBusy(true);
    const ok = await actions.makePlan({ title: corner.name, cornerKey: corner.key, startsAt: at, friendId: friendId || undefined });
    setBusy(false);
    if (ok) onClose();
  };

  const list = query.trim() ? [...choices.yours, ...choices.found.filter((f) => !choices.yours.some((y) => y.key === f.key))] : choices.yours;
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={title}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pb-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-small font-semibold text-muted-foreground">{SHEET.corner}</legend>
          <input aria-label={SHEET.findCorner} placeholder={SHEET.findCorner} className={FIELD} value={query} onChange={(e) => setQuery(e.target.value)} />
          {!query.trim() && choices.yours.length > 0 && <p className="text-caption text-muted-foreground">{SHEET.yourCorners}</p>}
          {query.trim() && list.length === 0 && <p className="text-small text-muted-foreground">{SHEET.noCorner}</p>}
          <ul className="flex flex-wrap gap-2">
            {list.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  aria-pressed={corner?.key === c.key}
                  onClick={() => setCorner(c)}
                  className={cn("min-h-11 rounded-full border px-4 text-small font-semibold", corner?.key === c.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground")}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-day">{SHEET.day}</Label>
          <select id="plan-day" className={FIELD} value={day} onChange={(e) => setDay(e.target.value)}>
            {dayOptions.map((d) => (
              <option key={d.offset + dateParam(d.noonMs)} value={dateParam(d.noonMs)}>
                {`${dayListHeading(d, now)} ${dayListDate(d, now)}`}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-small font-semibold text-muted-foreground">{SHEET.when}</legend>
          <div className="flex gap-2">
            {(["day", "eve"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={part === p}
                onClick={() => {
                  setPart(p);
                  setExact("");
                }}
                className={cn("min-h-11 flex-1 rounded-full border px-4 text-small font-semibold", part === p ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground")}
              >
                {p === "day" ? SHEET.daytime : SHEET.evening}
              </button>
            ))}
          </div>
          <Label htmlFor="plan-exact">{SHEET.exactTime}</Label>
          <input id="plan-exact" type="time" className={FIELD} value={exact} onChange={(e) => { setExact(e.target.value); const c = parseClock(e.target.value); if (c) setPart(c.h >= 18 ? "eve" : "day"); }} placeholder={`${DEFAULT_HOUR[part]}:00`} />
        </fieldset>
        {friends.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-friend">{SHEET.friend}</Label>
            <select id="plan-friend" className={FIELD} value={friendId} onChange={(e) => setFriendId(e.target.value)}>
              <option value="">{SHEET.nobody}</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="button" className={PRIMARY} disabled={!corner || busy || exactBad || past} onClick={() => void submit()}>
          {SHEET.makeIt}
        </button>
      </div>
    </ResponsiveSheet>
  );
}

// ---------- a plan you tap ----------

/** A day and a time to move a plan to. */
function WhenFields({ startMs, onSave, saveLabel }: { startMs: number; onSave: (ms: number) => void; saveLabel: string }) {
  const [day, setDay] = useState(dateParam(startMs));
  const [clock, setClock] = useState(clockOf(startMs));
  const c = parseClock(clock);
  const d = parseDateParam(day);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="move-day">{SHEET.day}</Label>
        <input id="move-day" type="date" className={FIELD} value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="move-time">{SHEET.when}</Label>
        <input id="move-time" type="time" className={FIELD} value={clock} onChange={(e) => setClock(e.target.value)} />
      </div>
      <button
        type="button"
        className={PRIMARY}
        disabled={!c || !d}
        onClick={() => {
          if (!c || !d) return;
          const w = weekDays(d, 1)[0];
          onSave(nyTimeToMs(w.y, w.m, w.d, c.h) + c.min * 60_000);
        }}
      >
        {saveLabel}
      </button>
    </div>
  );
}

function PlanSheet({ plan, actions, passes, onBring, onClose }: { plan: WeekPlanDetail; actions: CalendarActions; passes: readonly Pass[]; onBring: (p: WeekPlanDetail) => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const offered = planActions(plan);
  const kind = kindLine(plan);
  const where = placeLine(plan, passes);
  const who = goingLine(plan.going);
  const label: Record<PlanAction, string> = {
    change: plan.going.total > 1 ? SHEET.changeMyTime : SHEET.changeTime,
    move: SHEET.moveSession,
    bring: SHEET.bringSomeone,
    cancel: SHEET.cancelPlan,
    leave: SHEET.leavePlan,
    skip: SHEET.skipSession,
  };
  const run = (a: PlanAction) => {
    if (a === "change" || a === "move") return setEditing(true);
    if (a === "bring") onBring(plan);
    if (a === "cancel") actions.cancelPlan(plan);
    if (a === "leave") actions.leave(plan);
    if (a === "skip") actions.skipSession(plan);
    onClose();
  };
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={plan.title}>
      <div className="mb-4 flex flex-col gap-0.5">
        {kind && <span className="text-caption font-semibold text-muted-foreground">{kind}</span>}
        <span className="text-body font-semibold">{slotTitle(plan.startsAt)}</span>
        {where && <span className="text-small text-muted-foreground">{where}</span>}
        {who && <span className="text-small">{who}</span>}
      </div>
      {editing ? (
        <WhenFields
          startMs={plan.startsAt}
          saveLabel={SHEET.save}
          onSave={(ms) => {
            void actions.changePlanTime(plan, ms);
            onClose();
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {plan.pursuitId && isPursuitSession(plan) && (
            <Link to={`/pursuit/${plan.pursuitId}`} className={ROW}>
              {SHEET.openPursuit}
            </Link>
          )}
          {offered.map((a) => (
            <button key={a} type="button" className={ROW} onClick={() => run(a)}>
              {label[a]}
            </button>
          ))}
          {plan.kind === "event" && <p className="text-small text-muted-foreground">{SHEET.hostedLine}</p>}
        </div>
      )}
    </ResponsiveSheet>
  );
}

// ---------- free time you tap ----------

/** Two times of day for a free entry, kept on the day it starts (an end earlier than the start runs into the next day). */
function RangeFields({ startMs, endMs, onSave }: { startMs: number; endMs: number; onSave: (startMs: number, endMs: number) => void }) {
  const [from, setFrom] = useState(clockOf(startMs));
  const [to, setTo] = useState(clockOf(endMs));
  const a = parseClock(from);
  const b = parseClock(to);
  const base = weekDays(startMs, 1)[0];
  const at = (c: { h: number; min: number }, plusDays: number) => nyTimeToMs(base.y, base.m, base.d + plusDays, c.h) + c.min * 60_000;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="range-from">{SHEET.start}</Label>
        <input id="range-from" type="time" className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="range-to">{SHEET.end}</Label>
        <input id="range-to" type="time" className={FIELD} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <button
        type="button"
        className={PRIMARY}
        disabled={!a || !b || from === to}
        onClick={() => {
          if (!a || !b) return;
          const s = at(a, 0);
          let e = at(b, 0);
          if (e <= s) e = at(b, 1);
          onSave(s, e);
        }}
      >
        {SHEET.save}
      </button>
    </div>
  );
}

function FreeSheet({ slot, actions, onClose }: { slot: CalendarFreeSlot; actions: CalendarActions; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const entry = actions.entries.find((e) => slot.entryIds.includes(e.id) && e.kind === "free");
  const day = weekdayName(slot.startMs);
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={FREE_LABEL[slot.part]}>
      <p className="mb-4 text-small text-muted-foreground">{rangeText(slot.startMs, slot.endMs)}</p>
      {editing && entry ? (
        <RangeFields
          startMs={entry.startsAt}
          endMs={entry.endsAt}
          onSave={(s, e) => {
            void actions.changeEntry(entry, { startsAt: s, endsAt: e });
            onClose();
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {entry ? (
            <button type="button" className={ROW} onClick={() => setEditing(true)}>
              {SHEET.changeTimes}
            </button>
          ) : (
            <Link to="/week/free?from=week" className={ROW}>
              {SHEET.changeTimes}
            </Link>
          )}
          <button
            type="button"
            className={ROW}
            onClick={() => {
              void actions.notFreeThis(slot);
              onClose();
            }}
          >
            {SHEET.notFree(day)}
          </button>
          {slot.usualKeys.length > 0 && (
            <button
              type="button"
              className={ROW}
              onClick={() => {
                void actions.removeFromUsualWeek(slot.usualKeys);
                onClose();
              }}
            >
              {SHEET.removeUsual}
            </button>
          )}
          {entry && (
            <button
              type="button"
              className={ROW}
              onClick={() => {
                actions.removeFree(entry);
                onClose();
              }}
            >
              {SHEET.removeFree}
            </button>
          )}
        </div>
      )}
    </ResponsiveSheet>
  );
}

// ---------- a block you tap ----------

function BlockSheet({ occurrence, actions, onClose }: { occurrence: Occurrence; actions: CalendarActions; onClose: () => void }) {
  const entry: CalendarEntry = actions.entries.find((e) => e.id === occurrence.entry.id) ?? occurrence.entry;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note ?? "");
  const [repeat, setRepeat] = useState<EntryRepeat>(entry.repeat);
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={entry.note ?? SHEET.yourBlock}>
      <p className="mb-4 text-small text-muted-foreground">
        {`${slotTitle(occurrence.startMs)} to ${shortTime(occurrence.endMs)}`}
        {entry.repeat === "weekly" ? `, every ${formatWeekday(occurrence.startMs, "long", HOME_TZ)}` : ""}
      </p>
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-note">{SHEET.note}</Label>
            <input id="edit-note" className={FIELD} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
            <span className="text-caption text-muted-foreground">{SHEET.noteHint}</span>
          </div>
          <div className="flex gap-2" role="group" aria-label={SHEET.when}>
            {(["none", "weekly"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={repeat === r} onClick={() => setRepeat(r)} className={cn("min-h-11 flex-1 rounded-full border px-4 text-small font-semibold", repeat === r ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
                {r === "none" ? SHEET.once : SHEET.everyWeek}
              </button>
            ))}
          </div>
          <RangeFields
            startMs={entry.startsAt}
            endMs={entry.endsAt}
            onSave={(s, e) => {
              void actions.changeEntry(entry, { startsAt: s, endsAt: e, repeat, note });
              onClose();
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" className={ROW} onClick={() => setEditing(true)}>
            {SHEET.change}
          </button>
          <button
            type="button"
            className={ROW}
            onClick={() => {
              actions.removeBlock(entry);
              onClose();
            }}
          >
            {SHEET.removeBlock}
          </button>
        </div>
      )}
    </ResponsiveSheet>
  );
}

// ---------- a Stub you tap ----------

function StubSheet({ stub, onClose }: { stub: StubCard; onClose: () => void }) {
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={SHEET.stub}>
      <Ticket
        variant={stub.kind}
        serial={stub.serial ?? undefined}
        title={stub.title}
        meta={stub.meta}
        count={stub.count}
        color={`var(--cat-${stubColor(stub)})`}
      />
    </ResponsiveSheet>
  );
}

// ---------- Stubby's pick you tap ----------

function PickSheet({ slot, onKeep, onNotThis, onClose }: { slot: CalendarFreeSlot; onKeep: (slot: CalendarFreeSlot) => void; onNotThis: (slot: CalendarFreeSlot) => void; onClose: () => void }) {
  const pick = slot.pick;
  if (!pick) return null;
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={pick.title}>
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-caption font-semibold text-accent-text">{SHEET.stubbysPick}</span>
        <span className="text-body font-semibold">{`${slotTitle(pick.startsAt)} to ${shortTime(pick.endsAt)}`}</span>
        {pick.where && <span className="text-small text-muted-foreground">{pick.where}</span>}
        {pick.cost && <span className="text-small text-muted-foreground">{pick.cost}</span>}
        {pick.hostName && <span className="text-small text-muted-foreground">{`With ${pick.hostName}`}</span>}
        <span className="mt-2 text-small">{pick.reason}</span>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={PRIMARY}
          onClick={() => {
            onKeep(slot);
            onClose();
          }}
        >
          {SHEET.keep}
        </button>
        <button
          type="button"
          className={ROW}
          onClick={() => {
            onNotThis(slot);
            onClose();
          }}
        >
          {SHEET.notThis}
        </button>
      </div>
    </ResponsiveSheet>
  );
}
