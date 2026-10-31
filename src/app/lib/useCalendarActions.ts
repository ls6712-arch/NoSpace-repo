import { useCallback, useEffect, useMemo, useState } from "react";
import { notifyError } from "../components/ui/toaster";
import { track } from "./analytics";
import { addEntry, fetchEntries, removeEntry, updateEntry, type CalendarEntry, type EntryRepeat, type NewEntry } from "./calendarEntries";
import { CHANGED } from "./calendarCopy";
import type { CalendarFreeSlot } from "./calendarView";
import type { Owner } from "./firstPlanRemote";
import { savePrivate } from "./onboardingRemote";
import { cancelOwnPlan, createPlan, deleteSession, leavePlan, moveSession, planNumber, type NewPlan } from "./planEdits";
import { ERROR_LINE } from "./stateCopy";
import { announceChange, flushPendingChanges } from "./undo";
import type { WeekPlanDetail } from "./weekView";

/**
 * Every change a person makes on the calendar: adding, blocking, moving and
 * removing. Each shows on screen at once and offers Undo for 6 seconds. What
 * others would feel (cancelling or leaving a plan) is only sent once the 6
 * seconds are up, so Undo never has to un-send anything.
 */
export function useCalendarActions({ owner, usualWindows, reloadPlans }: { owner: Owner | null; usualWindows: readonly string[]; reloadPlans: () => void }) {
  const userId = owner?.id;
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [windows, setWindows] = useState<string[]>([...usualWindows]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [moved, setMoved] = useState<Readonly<Record<string, number>>>({});

  useEffect(() => setWindows([...usualWindows]), [usualWindows]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void fetchEntries(userId).then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
  }, [userId]);
  // Leaving the page sends what is still waiting out its 6 seconds.
  useEffect(() => flushPendingChanges, []);

  const hide = (id: string, on: boolean) =>
    setHidden((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** The plans as the person has changed them: the cancelled ones gone, the moved ones at their new time. */
  const applyToPlans = useCallback(
    (plans: readonly WeekPlanDetail[]) => plans.filter((p) => !hidden.has(p.id)).map((p) => (moved[p.id] !== undefined ? { ...p, startsAt: moved[p.id] } : p)),
    [hidden, moved],
  );

  // ---------- plans ----------

  const makePlan = useCallback(
    async (plan: NewPlan): Promise<boolean> => {
      if (!owner) return false;
      const r = await createPlan(plan, owner);
      if (r.error && r.sessionId === undefined) {
        notifyError(r.error);
        return false;
      }
      track({ name: "plan_created_from_calendar" });
      if (r.error) notifyError(r.error);
      reloadPlans();
      const sessionId = r.sessionId;
      if (sessionId !== undefined) {
        announceChange(CHANGED.planMade, {
          undo: () => {
            hide(`session-${sessionId}`, true);
            void cancelOwnPlan(sessionId, r.pursuitId).then((e) => e && notifyError(e));
          },
        });
      }
      return true;
    },
    [owner, reloadPlans],
  );

  /** Takes a plan off the calendar now and sends the removal after the 6 seconds, unless it is undone. */
  const removeLater = (plan: WeekPlanDetail, message: string, send: () => Promise<string | null>, after?: () => void) => {
    hide(plan.id, true);
    announceChange(message, {
      undo: () => hide(plan.id, false),
      commit: () => {
        void send().then((e) => {
          if (e) {
            hide(plan.id, false);
            notifyError(e);
          } else after?.();
        });
      },
    });
  };

  const cancelPlan = useCallback((plan: WeekPlanDetail) => {
    const id = planNumber(plan.id, "session");
    if (id === null) return;
    removeLater(plan, CHANGED.planRemoved, () => cancelOwnPlan(id, plan.pursuitId), () => track({ name: "plan_cancelled" }));
  }, []);

  const leave = useCallback(
    (plan: WeekPlanDetail) => {
      if (!userId) return;
      removeLater(plan, CHANGED.planLeft, () => leavePlan(plan, userId), () => track({ name: "plan_left" }));
    },
    [userId],
  );

  const skipSession = useCallback(
    (plan: WeekPlanDetail) => {
      const id = planNumber(plan.id, "session");
      if (!userId || id === null) return;
      removeLater(plan, CHANGED.sessionSkipped, () => (plan.mine ? deleteSession(id) : leavePlan(plan, userId)));
    },
    [userId],
  );

  const changePlanTime = useCallback(async (plan: WeekPlanDetail, startsAt: number) => {
    const id = planNumber(plan.id, "session");
    if (id === null || startsAt === plan.startsAt) return;
    const before = plan.startsAt;
    setMoved((m) => ({ ...m, [plan.id]: startsAt }));
    const error = await moveSession(id, startsAt);
    if (error) {
      setMoved((m) => ({ ...m, [plan.id]: before }));
      notifyError(error);
      return;
    }
    announceChange(CHANGED.timeChanged, {
      undo: () => {
        setMoved((m) => ({ ...m, [plan.id]: before }));
        void moveSession(id, before).then((e) => e && notifyError(e));
      },
    });
  }, []);

  // ---------- free time and blocks ----------

  const addNew = useCallback(
    async (e: NewEntry, message: string, event: "free" | "block" | "busy"): Promise<boolean> => {
      const r = await addEntry(e);
      if (!r.entry) {
        notifyError(r.error ?? ERROR_LINE);
        return false;
      }
      const entry = r.entry;
      setEntries((list) => [...list, entry]);
      const repeat: EntryRepeat = e.repeat ?? "none";
      if (event === "free") track({ name: "free_time_added", repeat });
      if (event === "block") track({ name: "block_added", repeat });
      announceChange(message, {
        undo: () => {
          setEntries((list) => list.filter((x) => x.id !== entry.id));
          void removeEntry(entry.id).then((err) => err && notifyError(err));
        },
      });
      return true;
    },
    [],
  );

  const addFree = useCallback((range: { startMs: number; endMs: number }, repeat: EntryRepeat) => addNew({ kind: "free", startsAt: range.startMs, endsAt: range.endMs, repeat }, CHANGED.freeAdded, "free"), [addNew]);
  const addBlock = useCallback((range: { startMs: number; endMs: number }, repeat: EntryRepeat, note?: string) => addNew({ kind: "block", startsAt: range.startMs, endsAt: range.endMs, repeat, note }, CHANGED.blockAdded, "block"), [addNew]);
  const notFreeThis = useCallback((slot: Pick<CalendarFreeSlot, "startMs" | "endMs">) => addNew({ kind: "busy", startsAt: slot.startMs, endsAt: slot.endMs }, CHANGED.notFree, "busy"), [addNew]);

  const changeEntry = useCallback(async (entry: CalendarEntry, fields: Partial<Pick<NewEntry, "startsAt" | "endsAt" | "repeat" | "note">>) => {
    const next: CalendarEntry = {
      ...entry,
      ...(fields.startsAt !== undefined ? { startsAt: fields.startsAt } : {}),
      ...(fields.endsAt !== undefined ? { endsAt: fields.endsAt } : {}),
      ...(fields.repeat !== undefined ? { repeat: fields.repeat } : {}),
      ...("note" in fields ? { note: fields.note?.trim() || undefined } : {}),
    };
    setEntries((l) => l.map((x) => (x.id === entry.id ? next : x)));
    const error = await updateEntry(entry.id, fields);
    if (error) {
      setEntries((l) => l.map((x) => (x.id === entry.id ? entry : x)));
      notifyError(error);
      return;
    }
    announceChange(entry.kind === "block" ? CHANGED.blockChanged : CHANGED.timeChanged, {
      undo: () => {
        setEntries((l) => l.map((x) => (x.id === entry.id ? entry : x)));
        void updateEntry(entry.id, { startsAt: entry.startsAt, endsAt: entry.endsAt, repeat: entry.repeat, note: entry.note }).then((e) => e && notifyError(e));
      },
    });
  }, []);

  /** Removing is sent after the 6 seconds, like cancelling a plan. */
  const removeOwn = useCallback((entry: CalendarEntry, message: string) => {
    setEntries((l) => l.filter((x) => x.id !== entry.id));
    announceChange(message, {
      undo: () => setEntries((l) => (l.some((x) => x.id === entry.id) ? l : [...l, entry])),
      commit: () => {
        void removeEntry(entry.id).then((e) => {
          if (e) {
            setEntries((l) => (l.some((x) => x.id === entry.id) ? l : [...l, entry]));
            notifyError(e);
          }
        });
      },
    });
  }, []);

  const removeBlock = useCallback((entry: CalendarEntry) => removeOwn(entry, CHANGED.blockRemoved), [removeOwn]);
  const removeFree = useCallback((entry: CalendarEntry) => removeOwn(entry, CHANGED.freeRemoved), [removeOwn]);

  /** Takes the windows a free slot covers out of the usual week. */
  const removeFromUsualWeek = useCallback(
    async (keys: readonly string[]) => {
      if (!userId || keys.length === 0) return;
      const before = windows;
      const after = before.filter((k) => !keys.includes(k));
      setWindows(after);
      const saved = await savePrivate(userId, { free_windows: after.length > 0 ? after : null });
      if (saved.error) {
        setWindows(before);
        notifyError(saved.error);
        return;
      }
      announceChange(CHANGED.usualRemoved, {
        undo: () => {
          setWindows(before);
          void savePrivate(userId, { free_windows: before.length > 0 ? before : null }).then((r) => r.error && notifyError(r.error));
        },
      });
    },
    [userId, windows],
  );

  return useMemo(
    () => ({ entries, windows, applyToPlans, makePlan, cancelPlan, leave, skipSession, changePlanTime, addFree, addBlock, notFreeThis, changeEntry, removeBlock, removeFree, removeFromUsualWeek }),
    [entries, windows, applyToPlans, makePlan, cancelPlan, leave, skipSession, changePlanTime, addFree, addBlock, notFreeThis, changeEntry, removeBlock, removeFree, removeFromUsualWeek],
  );
}

export type CalendarActions = ReturnType<typeof useCalendarActions>;
