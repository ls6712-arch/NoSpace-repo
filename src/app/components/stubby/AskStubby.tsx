import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { plural } from "../../lib/plural";
import { ASK_COPY, QUESTION_COPY, UNDERSTOOD_COPY } from "../../lib/calendarCopy";
import { groupPicks, latestAskToday } from "../../lib/askGroups";
import {
  addCards,
  bringBack as deckBringBack,
  dealDeck,
  dropCards,
  frontCard,
  keepFront,
  loadDeck,
  notNowFront,
  prune,
  saveDeck,
  seeSkipped as deckSeeSkipped,
  unselect as deckUnselect,
  EMPTY_DECK,
  type DeckState,
} from "../../lib/stubbyDeck";
import { STUBBY_LINES } from "../../lib/stubbyLines";
import {
  ASK_MAX_LENGTH,
  ASKS_PER_DAY,
  GUEST_ASKS_PER_DAY,
  askStatus,
  askStubbyStream,
  asksLeft as readAsksLeft,
  fetchMyPicks,
  readTaste,
  removeMyPick,
  saveTaste,
  sendFeedback,
  tasteIsEmpty,
  type Taste,
  type AskAnswers,
  type AskFollowUp,
  type AskStep,
  type MyPick,
  type Understood,
} from "../../lib/stubbyAsk";
import type { BuddyReaction } from "./StubbyBuddy";
import { useStubbyAccess } from "../../context/StubbyAccess";
import { GuestClosedPanel, LimitPanel } from "./GuestPrompts";
import { guestSession } from "../../../lib/guestSupabase";
import { track } from "../../lib/analytics";
import { RESUME_KEY } from "../../lib/signUpReturn";

/**
 * How the last ask ended, for Stubby's line: found something, found only the soonest after
 * tonight, found nothing, or failed.
 */
export type AskOutcome = "found" | "after" | "nothing" | "error" | null;
export type Question = "setting" | "who" | "when" | "what";
export type Who = NonNullable<AskAnswers["who"]>;
export type FollowUpKind = AskFollowUp["kind"];

/** One live step while he looks (Stubby plan §7), ticked once the next one starts. */
export interface StepRow {
  key: string;
  kind: "search" | "pages" | "picking";
  query?: string;
  count?: number;
  done: boolean;
}

/** An answer to Stubby's one question. */
export type Answer = { setting: "in" | "out" } | { who: Who } | { when: string } | { what: string } | { surprise: true } | { typed: string };

export interface AskState {
  text: string;
  setText: (text: string) => void;
  busy: boolean;
  error: string | null;
  status: string | null;
  outcome: AskOutcome;
  /** Asks left today, once known. */
  left: number | null;
  /** Today's picks from earlier asks, not in the deck or Your selection. */
  earlier: MyPick[];
  /** What Stubby understood from the ask, while he looks. */
  understood: Understood | null;
  steps: StepRow[];
  /** No new step for 12 seconds. */
  stalled: boolean;
  /** Stubby's one question, waiting for a tap. */
  question: Question | null;
  /** Who you're going with, remembered for this session (a chip you can remove). */
  who: Who | null;
  forgetWho: () => void;
  answer: (a: Answer) => void;
  /** The deck (stubby-plan §6.5) and its picks. */
  deck: DeckState;
  pick: (id: number) => MyPick | undefined;
  /** The card that carries the bring-a-friend nudge this time, if any. */
  nudgeId: number | null;
  keep: () => void;
  notNow: () => void;
  bringBack: () => void;
  seeSkipped: () => void;
  unselect: (id: number) => void;
  /** Made into plans: gone from Your selection. */
  madePlans: (ids: number[]) => void;
  followUp: (kind: FollowUpKind) => void;
  /** Asks the last thing again, with any answer already given, so it never asks its question twice. */
  retry: () => void;
  /** When nothing fits: the 3 most common reasons, with counts. */
  reasons: { key: string; count: number }[];
  /** The last ask was for tonight (which "nothing fits" line he says). */
  tonight: boolean;
  /** The ways on when nothing fits: the same ask this weekend, or a surprise. */
  tryWeekend: () => void;
  surprise: () => void;
  ask: (what: string) => Promise<void>;
  /** The day's allowance, from the server once known (guests and accounts differ). */
  perDay: number;
  /** An account's allowance, for what signing up gets a guest. */
  accountPerDay: number;
  /** Thumbs on picks, this session. */
  rated: Record<number, "up" | "down">;
  rate: (id: number, s: "up" | "down") => void;
  /** The quick-context card: shown before the first ask while the taste profile is empty. */
  showContext: boolean;
  saveContext: (t: Taste) => Promise<void>;
  skipContext: () => void;
  /** Stops listening. The ask was paid for, so it still counts. */
  stop: () => void;
  remove: (p: MyPick) => Promise<void>;
}

/** With no new step for this long, he says he's still looking. */
export const STALL_MS = 12_000;
export const ANSWERS_KEY = "soosh.stubby.answers.v1";
export const NUDGE_KEY = "soosh.stubby.nudge.v1";
export { RESUME_KEY } from "../../lib/signUpReturn";
const CONTEXT_SKIPPED_KEY = "soosh.stubby.contextSkipped.v1";
const readLocal = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLocal = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: remembered for this page only.
  }
};

const readSession = <T,>(key: string): T | null => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeSession = (key: string, value: unknown) => {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: remembered for this page only.
  }
};
const WHO_VALUES: readonly Who[] = ["solo", "partner", "friends", "family"];

/**
 * Asking Stubby, as state: what is typed, his one question, whether he is looking and his
 * steps, how many asks are left today, and his picks as a deck with Your selection. The form
 * (AskStubby) and the results (StubbyResults) both read it, so the results can sit anywhere.
 */
export function useAskStubby({ onReact, userId }: { onReact?: (r: BuddyReaction) => void; userId?: string } = {}): AskState {
  const access = useStubbyAccess();
  const client = access.client;
  const guest = access.guest;
  const [perDay, setPerDay] = useState(guest ? GUEST_ASKS_PER_DAY : ASKS_PER_DAY);
  const [accountPerDay, setAccountPerDay] = useState(ASKS_PER_DAY);
  const [rated, setRated] = useState<Record<number, "up" | "down">>({});
  const [taste, setTaste] = useState<Taste | null | undefined>(undefined);
  const [contextSkipped, setContextSkipped] = useState(() => readLocal(CONTEXT_SKIPPED_KEY) === "1");
  const sent = useRef(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<AskOutcome>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [picks, setPicks] = useState<MyPick[]>([]);
  const [askId, setAskId] = useState<number | null>(null);
  const [understood, setUnderstood] = useState<Understood | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [stalled, setStalled] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [reasons, setReasons] = useState<{ key: string; count: number }[]>([]);
  const [tonight, setTonight] = useState(false);
  const [who, setWho] = useState<Who | null>(() => {
    const w = readSession<{ who?: string }>(ANSWERS_KEY)?.who;
    return w && (WHO_VALUES as readonly string[]).includes(w) ? (w as Who) : null;
  });
  const [deck, setDeckState] = useState<DeckState>(EMPTY_DECK);
  const [nudge, setNudge] = useState<{ set: number | null; id: number | null }>({ set: null, id: null });
  const react = useRef(onReact);
  react.current = onReact;
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const lastAsk = useRef("");
  /** The answer given for the last ask, so asking it again never asks the question again. */
  const lastAnswers = useRef<AskAnswers | undefined>(undefined);
  const pending = useRef("");
  const stallTimer = useRef<number | undefined>(undefined);
  const userRef = useRef(userId);
  userRef.current = userId;

  const setDeck = useCallback((next: DeckState | ((d: DeckState) => DeckState)) => {
    setDeckState((d) => {
      const v = typeof next === "function" ? next(d) : next;
      saveDeck(userRef.current, v);
      return v;
    });
  }, []);

  /** The bring-a-friend nudge: at most once per set, never two sets in a row in one session. */
  const placeNudge = useCallback((set: number, fresh: MyPick[]) => {
    const last = readSession<{ set: number; shown: boolean }>(NUDGE_KEY);
    if (last?.set === set) return setNudge({ set, id: last.shown ? (fresh.find((p) => p.betterWithFriend)?.id ?? null) : null });
    const flagged = last?.shown ? null : (fresh.find((p) => p.betterWithFriend)?.id ?? null);
    writeSession(NUDGE_KEY, { set, shown: flagged !== null });
    setNudge({ set, id: flagged });
  }, []);

  useEffect(() => {
    let live = true;
    track({ name: "stubby_opened", who: guest ? "guest" : "user" });
    void (async () => {
      // A guest with no session yet has nothing saved: no guest is made just for opening the page.
      if (guest && !(await guestSession())) {
        if (live) setTaste(null);
        return null;
      }
      // The server's own count and allowance, and the taste profile, arrive on their own: the
      // picks and the counted asks show at once.
      void askStatus(client).then((status) => {
        if (!live || !status) return;
        setPerDay(status.perDay);
        setAccountPerDay(status.accountPerDay);
        setLeft(status.left);
      });
      void readTaste(client).then((t) => {
        if (live) setTaste(t);
      });
      return Promise.all([fetchMyPicks(Date.now(), client), readAsksLeft(Date.now(), client, guest ? GUEST_ASKS_PER_DAY : ASKS_PER_DAY)]);
    })().then((r) => {
      if (!live || !r) return;
      const [p, counted] = r;
      setPicks(p);
      setLeft((now) => now ?? counted);
      const latest = latestAskToday(p, Date.now());
      setAskId(latest);
      // The saved deck, minus picks that are gone; or this ask's picks, freshly dealt.
      const saved = prune(loadDeck(userRef.current), new Set(p.map((x) => x.id)));
      const next = saved.all.length > 0 || saved.selection.length > 0 ? saved : latest !== null ? dealDeck(saved, p.filter((x) => x.askId === latest).map((x) => x.id)) : saved;
      setDeck(next);
      if (latest !== null) placeNudge(latest, p.filter((x) => x.askId === latest));
    });
    return () => {
      live = false;
      controller.current?.abort();
      window.clearTimeout(stallTimer.current);
    };
  }, [setDeck, placeNudge, client, guest]);

  const resetStall = useCallback(() => {
    window.clearTimeout(stallTimer.current);
    setStalled(false);
    stallTimer.current = window.setTimeout(() => setStalled(true), STALL_MS);
  }, []);
  const endStall = useCallback(() => {
    window.clearTimeout(stallTimer.current);
    setStalled(false);
  }, []);

  const onStep = useCallback(
    (s: AskStep) => {
      resetStall();
      if (s.type === "understood") return setUnderstood(s.understood);
      setSteps((all) => {
        const ticked = all.map((r) => ({ ...r, done: true }));
        const last = all[all.length - 1];
        // The page count grows in place; everything else is a new step.
        if (s.type === "pages" && last?.kind === "pages") return [...ticked.slice(0, -1), { ...last, count: s.count, done: false }];
        if (s.type === "search") return [...ticked, { key: `s${all.length}`, kind: "search", query: s.query, done: false }];
        if (s.type === "pages") return [...ticked, { key: `p${all.length}`, kind: "pages", count: s.count, done: false }];
        return [...ticked, { key: `k${all.length}`, kind: "picking", done: false }];
      });
    },
    [resetStall],
  );

  const run = useCallback(
    async (what: string, opts: { answers?: AskAnswers; followUp?: AskFollowUp } = {}) => {
      if (running.current) return;
      running.current = true;
      if (!opts.followUp) {
        lastAsk.current = what;
        lastAnswers.current = opts.answers;
      }
      const c = new AbortController();
      controller.current = c;
      setBusy(true);
      setError(null);
      setFound(null);
      setOutcome(null);
      setQuestion(null);
      setReasons([]);
      setUnderstood(null);
      setSteps([]);
      resetStall();
      // Who you're going with, once said, goes with every ask this session: as a remembered chip,
      // below what you type now (stubby-agent B3), so "with my girlfriend" wins over Just me.
      const answers: AskAnswers | undefined = who || opts.answers ? { ...(who ? { rememberedWho: who } : {}), ...opts.answers } : undefined;
      access.draft.current = what;
      let r: Awaited<ReturnType<typeof askStubbyStream>>;
      try {
        // A guest is made on the first ask, not before.
        if (guest && !(await access.ensureSession())) {
          // Guests switched off: the closed state, not an error. Anything else is the usual error.
          r = access.isClosed() ? { found: 0, asksLeft: null, error: null, closed: true } : { found: 0, asksLeft: null, error: STUBBY_LINES.error };
        } else {
          r = await askStubbyStream(what, { signal: c.signal, onStep, answers, questions: !opts.answers && !opts.followUp, followUp: opts.followUp ?? null, client });
        }
      } catch {
        // Stopped: stop() has already put things back.
        return;
      } finally {
        if (controller.current === c) {
          running.current = false;
          controller.current = null;
        }
      }
      if (c.signal.aborted) return;
      endStall();
      setBusy(false);
      setSteps([]);
      if (r.closed) {
        access.markClosed();
        return;
      }
      if (r.limit) {
        // Refused before searching. A guest sees the limit panel (or the sign-up sheet for an
        // account-only follow-up); an account sees Stubby's out-of-asks line, as before.
        if (r.limit.code === "SIGNUP_REQUIRED") access.gate("more");
        else {
          setLeft(0);
          access.showLimit(r.limit);
        }
        react.current?.("shrug");
        return;
      }
      if (r.question) {
        // One question, answered with a tap. Nothing was searched; no ask was used.
        pending.current = what;
        setQuestion(r.question);
        if (r.asksLeft !== null) setLeft(r.asksLeft);
        return;
      }
      if (r.error) {
        setError(r.error);
        setOutcome("error");
        react.current?.("tilt");
        return;
      }
      if (r.asksLeft !== null) setLeft(r.asksLeft);
      // One more ask made: counted for the 3rd-ask card and analytics (never the words).
      if (!r.free) {
        const n = guest ? access.noteAsk() : (sent.current += 1);
        track({ name: "stubby_message_sent", who: guest ? "guest" : "user", messageNumber: n });
        if (guest && n >= 3) access.offerInlineCard();
      }
      setReasons(r.reasons ?? []);
      setTonight(r.when === "tonight");
      const fresh = await fetchMyPicks(Date.now(), client);
      const id = r.askId ?? latestAskToday(fresh, Date.now());
      setPicks(fresh);
      const mine = id === null ? [] : fresh.filter((p) => p.askId === id);
      if (opts.followUp) {
        // A follow-up adds cards to the back of the deck.
        setDeck((d) => addCards(d, mine.map((p) => p.id)));
      } else {
        setAskId(id);
        setDeck((d) => dealDeck(d, mine.map((p) => p.id)));
        if (id !== null) placeNudge(id, mine);
      }
      if (r.found > 0) setText("");
      if (r.found > 0 && r.outcome === "after") {
        // Nothing fit tonight: Stubby's line says so, and these are the soonest after.
        setOutcome("after");
        react.current?.("shrug");
      } else if (r.found > 0) {
        setFound(mine.length || r.found);
        setOutcome("found");
        react.current?.("stamped");
      } else {
        setOutcome("nothing");
        react.current?.("shrug");
      }
    },
    [who, onStep, resetStall, endStall, setDeck, placeNudge, access, client, guest],
  );

  const ask = useCallback(
    async (what: string) => {
      // While Stubby's question waits, typing an answer works too.
      if (question && pending.current) return run(`${pending.current}, ${what}`, { answers: { skip: true } });
      return run(what);
    },
    [question, run],
  );

  const answer = useCallback(
    (a: Answer) => {
      const base = pending.current || lastAsk.current;
      if (!base) return;
      if ("setting" in a) void run(base, { answers: { setting: a.setting } });
      else if ("who" in a) {
        setWho(a.who);
        writeSession(ANSWERS_KEY, { who: a.who });
        void run(base, { answers: { who: a.who } });
      } else if ("when" in a) void run(base, { answers: { when: a.when } });
      else if ("what" in a) void run(`${base}, ${a.what.toLowerCase()}`, { answers: { skip: true } });
      else if ("typed" in a) void run(`${base}, ${a.typed}`, { answers: { skip: true } });
      else void run(base, { answers: { skip: true } });
    },
    [run],
  );

  const forgetWho = useCallback(() => {
    setWho(null);
    writeSession(ANSWERS_KEY, null);
  }, []);

  const stop = useCallback(() => {
    const c = controller.current;
    if (!c) return;
    c.abort();
    controller.current = null;
    running.current = false;
    endStall();
    setBusy(false);
    setSteps([]);
    setUnderstood(null);
    // The ask was paid for: it still counts.
    setLeft((n) => (n === null ? n : Math.max(0, n - 1)));
  }, [endStall]);

  const retry = useCallback(() => {
    if (lastAsk.current) void run(lastAsk.current, lastAnswers.current ? { answers: lastAnswers.current } : {});
  }, [run]);
  // When nothing fits: the same ask this weekend (it counts as answered, so no question), or a surprise.
  const tryWeekend = useCallback(() => {
    if (lastAsk.current) void run(lastAsk.current, { answers: { ...lastAnswers.current, when: "weekend" } });
  }, [run]);
  const surprise = useCallback(() => void run(QUESTION_COPY.surprise, { answers: { skip: true } }), [run]);

  const byId = useMemo(() => new Map(picks.map((p) => [p.id, p])), [picks]);
  const pick = useCallback((id: number) => byId.get(id), [byId]);

  const keep = useCallback(() => {
    const id = frontCard(deck);
    if (id === null) return;
    setDeck(keepFront);
    react.current?.("stamped");
    // A Keep counts as a signal for next time.
    void sendFeedback(id, "save", client);
  }, [deck, setDeck, client]);
  const rate = useCallback(
    (id: number, signal: "up" | "down") => {
      setRated((r) => ({ ...r, [id]: signal }));
      void sendFeedback(id, signal, client);
    },
    [client],
  );
  const notNow = useCallback(() => {
    if (frontCard(deck) === null) return;
    setDeck(notNowFront);
    react.current?.("shrug");
  }, [deck, setDeck]);
  const bringBack = useCallback(() => setDeck(deckBringBack), [setDeck]);
  const seeSkipped = useCallback(() => setDeck(deckSeeSkipped), [setDeck]);
  const unselect = useCallback((id: number) => setDeck((d) => deckUnselect(d, id)), [setDeck]);
  const madePlans = useCallback((ids: number[]) => setDeck((d) => dropCards(d, ids)), [setDeck]);

  const followUp = useCallback(
    (kind: FollowUpKind) => {
      // Follow-ups are for accounts: a guest gets the sign-up sheet, naming it.
      if (guest) return access.gate("more");
      const of = askId;
      if (of === null || !lastAsk.current) return;
      const titles = deck.all.map((id) => byId.get(id)?.title).filter((t): t is string => !!t).slice(0, 10);
      void run(lastAsk.current, { followUp: { of, kind, titles } });
    },
    [askId, deck.all, byId, run, guest, access],
  );

  const remove = useCallback(
    async (p: MyPick) => {
      setPicks((all) => all.filter((x) => x.id !== p.id));
      setDeck((d) => dropCards(d, [p.id]));
      const r = await removeMyPick(p.id, client);
      if (r.error) {
        setError(r.error);
        setPicks(await fetchMyPicks(Date.now(), client));
      }
    },
    [setDeck, client],
  );

  const saveContext = useCallback(
    async (t: Taste) => {
      setTaste(t);
      // Saving needs a session: for a guest, this is where it is made.
      if (await access.ensureSession()) await saveTaste(t, client);
    },
    [access, client],
  );
  const skipContext = useCallback(() => {
    setContextSkipped(true);
    writeLocal(CONTEXT_SKIPPED_KEY, "1");
  }, []);

  // A guest at 0 asks: the field gives way to the limit panel at once, with when they can ask again.
  const limitShown = useRef(false);
  useEffect(() => {
    if (!guest || left !== 0 || limitShown.current) return;
    limitShown.current = true;
    void askStatus(client).then((s) => access.showLimit({ code: "GUEST_LIMIT_REACHED", resetsAt: s?.resetsAt ?? null }));
  }, [guest, left, client, access]);

  // Back from signing up: the ask that was in the field, sent for them if the limit stopped it.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || guest) return;
    const r = readSession<{ draft?: string; send?: boolean }>(RESUME_KEY);
    if (!r || typeof r.draft !== "string") return;
    resumed.current = true;
    writeSession(RESUME_KEY, null);
    const draft = r.draft.slice(0, ASK_MAX_LENGTH);
    setText(draft);
    if (r.send && draft.trim().length >= 2) void run(draft);
  }, [guest, run]);

  const earlier = useMemo(() => {
    const inDeck = new Set([...deck.all, ...deck.selection]);
    return groupPicks(picks, askId, Date.now()).earlier.filter((p) => !inDeck.has(p.id));
  }, [picks, askId, deck]);
  const status = outcome === "found" && found ? `Found ${plural(found, "thing")}.` : outcome === "nothing" ? ASK_COPY.nothing : null;
  const nudgeId = nudge.id !== null && deck.order.includes(nudge.id) ? nudge.id : null;
  // Before the first ask, while nothing is known: not once anything was asked or found.
  const showContext = taste !== undefined && tasteIsEmpty(taste) && !contextSkipped && picks.length === 0 && !busy && outcome === null;

  return {
    text,
    setText,
    busy,
    error,
    status,
    outcome,
    left,
    earlier,
    understood,
    steps,
    stalled,
    question,
    who,
    forgetWho,
    answer,
    deck,
    pick,
    nudgeId,
    keep,
    notNow,
    bringBack,
    seeSkipped,
    unselect,
    madePlans,
    followUp,
    retry,
    reasons,
    tonight,
    tryWeekend,
    surprise,
    ask,
    perDay,
    accountPerDay,
    rated,
    rate,
    showContext,
    saveContext,
    skipContext,
    stop,
    remove,
  };
}

/** Stubby's line for his one question. */
export const QUESTION_LINE: Record<Question, string> = { setting: STUBBY_LINES.missingSetting, who: STUBBY_LINES.missingWho, when: STUBBY_LINES.missingWhen, what: STUBBY_LINES.missingVibe };

/**
 * The ask, in the page: the field ("What are you in the mood for?"), how many asks are left
 * today beside it, Ask Stubby, and the quick ideas. When Stubby asks his one question, the
 * quick ideas give way to its answers (plus Surprise me); typing an answer works too. Who
 * you're going with, once answered, stays as a chip you can remove. On a phone the chips are
 * one row that scrolls sideways, so the calendar still shows in the first screen. At 0 the
 * field is off and the quick ideas are gone; Stubby's own line says so.
 */
export function AskStubby({
  state,
  inputId: givenId,
  onFieldFocus,
  hideLabel = false,
}: {
  state: AskState;
  /** The field's id, so the page can focus it (the sticky bar). */
  inputId?: string;
  onFieldFocus?: () => void;
  /** Stubby is already asking the same question: the label stays for screen readers only. */
  hideLabel?: boolean;
}) {
  const ownId = useId();
  const dayId = useId();
  const inputId = givenId ?? ownId;
  const { text, setText, busy, left, ask, question, answer, who, forgetWho } = state;
  const access = useStubbyAccess();
  const out = left === 0;
  const [picking, setPicking] = useState(false);
  // A guest's quick ideas show before their first ask too (no count is known yet).
  const known = left !== null || access.guest;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };
  const quick = (idea: string) => {
    track({ name: "stubby_example_prompt_clicked", who: access.guest ? "guest" : "user" });
    setText(idea);
    void ask(idea);
  };
  const row = "-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:mx-0 tab:flex-wrap tab:overflow-visible tab:px-0 tab:pb-0 [&::-webkit-scrollbar]:hidden";
  const chip = (label: string, onClick: () => void, key = label) => (
    <Chip key={key} aria-pressed={undefined} disabled={busy} onClick={onClick} className="shrink-0 snap-start border border-border">
      {label}
    </Chip>
  );

  // Guests aren't open: no field, no quick ideas, no error. Logging in or signing up still works.
  if (access.guest && access.closed) return <GuestClosedPanel />;

  // At a guest's limit (or the guest cap) the field gives way to what signing up gets them.
  // Everything already found stays readable below.
  if (access.prompt?.kind === "limit" || (access.guest && access.prompt?.kind === "sheet" && access.prompt.trigger === "limit")) {
    return <LimitPanel perDay={state.perDay} accountPerDay={state.accountPerDay} onSignUp={() => (access.draft.current = text)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={inputId} className={cn("text-small font-semibold", hideLabel && "sr-only")}>
            {ASK_COPY.label}
          </label>
          {left !== null && !out && <p className="ml-auto shrink-0 text-caption text-muted-foreground">{`${plural(left, "ask")} left today`}</p>}
        </div>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={text}
            maxLength={ASK_MAX_LENGTH}
            placeholder={ASK_COPY.placeholder}
            onChange={(e) => setText(e.target.value)}
            onFocus={onFieldFocus}
            disabled={busy || out}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={busy || out || text.trim().length < 2} aria-busy={busy} className="shrink-0">
            {busy ? ASK_COPY.busy : ASK_COPY.button}
          </Button>
        </div>
      </form>
      {who && !question && (
        <div className="flex">
          <span data-stubby-who="" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card pl-3 text-small font-semibold">
            {UNDERSTOOD_COPY.who[who]}
            <button type="button" onClick={forgetWho} aria-label={`${ASK_COPY.remove}: ${UNDERSTOOD_COPY.who[who]}`} className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
      {question && !out && (
        <div role="group" aria-label={QUESTION_LINE[question]} data-stubby-question={question} className={row}>
          {question === "setting" && QUESTION_COPY.setting.map((c) => chip(c.label, () => answer({ setting: c.setting })))}
          {question === "who" && QUESTION_COPY.who.map((c) => chip(c.label, () => answer({ who: c.who })))}
          {question === "when" && QUESTION_COPY.when.map((c) => chip(c.label, () => answer({ when: c.when })))}
          {question === "when" && chip(QUESTION_COPY.pickADay, () => setPicking((p) => !p), "pick")}
          {question === "what" && QUESTION_COPY.what.map((c) => chip(c, () => answer({ what: c })))}
          {chip(QUESTION_COPY.surprise, () => answer({ surprise: true }), "surprise")}
        </div>
      )}
      {question === "when" && picking && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dayId} className="text-small font-semibold">
            {QUESTION_COPY.pickADay}
          </label>
          <Input
            id={dayId}
            type="date"
            className="max-w-56"
            onChange={(e) => {
              if (!e.target.value) return;
              setPicking(false);
              answer({ when: e.target.value });
            }}
          />
        </div>
      )}
      {!question && known && !out && state.outcome !== "nothing" && (
        // A phone: one row that scrolls sideways, edge to edge. From 744px: wraps. When nothing
        // fit, they step aside: the empty state below has its own ways on (one "This weekend").
        <div role="group" aria-label={ASK_COPY.chipsLabel} className={row}>
          {ASK_COPY.chips.map((idea) => chip(idea, () => quick(idea)))}
        </div>
      )}
    </div>
  );
}
