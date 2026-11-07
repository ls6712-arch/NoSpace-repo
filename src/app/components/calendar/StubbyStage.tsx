import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocation } from "react-router";
import { exampleFromEntry } from "../../landing/examples";
import { ASK_COPY } from "../../lib/calendarCopy";
import { page } from "../../lib/motionTokens";
import { STUBBY_LINES, greetingLine, type GreetingInput } from "../../lib/stubbyLines";
import { takeHello } from "../../lib/stubbyStage";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { AskStubby, QUESTION_LINE, useAskStubby, type AskState } from "../stubby/AskStubby";
import { frontCard } from "../../lib/stubbyDeck";
import { StubbyBuddy, type BuddyReaction, type StubbyBuddyHandle } from "../stubby/StubbyBuddy";
import { StubbyResults, type DeckActions } from "../stubby/StubbyResults";
import { ContextCard } from "../stubby/ContextCard";
import { GuestSignUpButton, InlineSignUpCard } from "../stubby/GuestPrompts";
import { SignUpSheet } from "../stubby/SignUpSheet";
import { AdultPrompt } from "../stubby/Birthday";
import { useStubbyAccess } from "../../context/StubbyAccess";
import { stubbyAskEnabled } from "../../config";
import { GUEST_COPY, outOfAsksLine } from "../../lib/guestCopy";

/** A hover or focus hop at most this often, so a wandering pointer doesn't keep him bouncing. */
const EAGER_GAP_MS = 1500;
/** Stubby's width on the stage: a phone, then 744px and up. In the sticky bar he is the mark. */
const STAGE_PHONE = 88;
const STAGE_TAB = 112;
const STICKY = 36;

export interface StubbyStageHandle {
  react: (r: BuddyReaction) => void;
}

type LineState = Pick<AskState, "busy" | "left" | "outcome" | "stalled"> &
  Partial<Pick<AskState, "question" | "deck" | "nudgeId" | "tonight" | "perDay">> & {
    /** Guests are paused for now (the guest cap): his line says so instead of the day's count. */
    capped?: boolean;
  };

/**
 * What Stubby says right now, the first that fits: he's looking; his one question; the card in
 * front is better with a friend; the deck has run out; 0 asks left; how the last ask went; his greeting.
 */
export function stageLine(state: LineState, greeting: string): string {
  if (state.busy) return state.stalled ? STUBBY_LINES.stillLooking : STUBBY_LINES.looking;
  if (state.question) return QUESTION_LINE[state.question];
  const deck = state.deck;
  if (deck && state.nudgeId != null && frontCard(deck) === state.nudgeId) return STUBBY_LINES.bringAFriend;
  if (deck && deck.all.length > 0 && frontCard(deck) === null) return STUBBY_LINES.deckRunOut;
  if (state.capped) return GUEST_COPY.busy;
  if (state.left === 0) return state.perDay ? outOfAsksLine(state.perDay) : STUBBY_LINES.outOfAsks;
  if (state.outcome === "found") return STUBBY_LINES.found;
  if (state.outcome === "after") return state.tonight === false ? STUBBY_LINES.nothingThen : STUBBY_LINES.nothingFits;
  if (state.outcome === "nothing") return ASK_COPY.nothing;
  if (state.outcome === "error") return STUBBY_LINES.error;
  return greeting;
}

/**
 * Stubby, the main character of Calendar (claude-code-brief-stubby-calendar-hero.md):
 * big and smiling at the top of the page, above the toolbar, with his line in a speech
 * bubble and Ask Stubby right in the page. What he finds lands right under him
 * (StubbyResults). Everything Calendar reacts to plays on him (the handle's `react`).
 *
 * He is the one Stubby on the page. Once the stage scrolls out of view, a slim sticky bar
 * (the mark and "Ask Stubby…") brings you back to him.
 */
export const StubbyStage = forwardRef<
  StubbyStageHandle,
  {
    greeting: Omit<GreetingInput, "asksLeft">;
    /** Calendar is loading: he thinks. */
    loading?: boolean;
    /** Calendar couldn't load: he tilts. */
    failed?: boolean;
    /** A sheet is open: the sticky bar steps aside. */
    sheetOpen?: boolean;
    /** Whose deck: it's kept in this browser, per person. */
    userId?: string;
  } & DeckActions
>(function StubbyStage({ greeting, loading = false, failed = false, sheetOpen = false, userId, onMakePlans, onBring }, ref) {
  const inputId = useId();
  const stage = useRef<HTMLElement | null>(null);
  const buddy = useRef<StubbyBuddyHandle>(null);
  const mini = useRef<StubbyBuddyHandle>(null);
  const reduce = useReducedMotion() ?? false;
  const tab = useMediaQuery("(min-width: 744px)");
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  const react = useCallback((r: BuddyReaction) => {
    buddy.current?.react(r);
    mini.current?.react(r);
  }, []);
  useImperativeHandle(ref, () => ({ react }), [react]);

  const location = useLocation();
  // The landing passes only a known example id. Seed an editable field, never an automatic ask.
  // The existing signup-resume effect runs after initialization and keeps precedence over this draft.
  const ask = useAskStubby({ onReact: react, userId, initialDraft: exampleFromEntry(location.state)?.prompt });
  const access = useStubbyAccess();
  useEffect(() => {
    if (access.guest) access.draft.current = ask.text;
  }, [access.guest, access.draft, ask.text]);
  const capped = access.prompt?.kind === "limit" && (access.prompt.limit.code === "GUEST_GLOBAL_CAP" || access.prompt.limit.code === "GLOBAL_CAP");
  // Guests aren't open: his line says how to use him instead of greeting a field that isn't there.
  const line = access.guest && access.closed ? GUEST_COPY.closed : stageLine({ ...ask, capped }, greetingLine({ ...greeting, asksLeft: ask.left }));

  // Hello, once a session: a hop and one soft ring.
  const [ring, setRing] = useState(false);
  useEffect(() => {
    if (!takeHello()) return;
    buddy.current?.react("hello");
    if (!reduce) setRing(true);
  }, [reduce]);

  const lastEager = useRef(0);
  const eager = () => {
    if (ask.busy || loading || Date.now() - lastEager.current < EAGER_GAP_MS) return;
    lastEager.current = Date.now();
    buddy.current?.react("eager");
  };

  // The sticky bar: shown once the stage has scrolled up out of view.
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const backToStage = () => {
    stage.current?.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
    document.getElementById(inputId)?.focus({ preventScroll: true });
  };

  const size = tab ? STAGE_TAB : STAGE_PHONE;
  return (
    <>
      {/* No height of its own, so it never pushes the page when it appears. Below the phone header, above nothing else. */}
      <div className="sticky top-[calc(var(--safe-top)+65px)] z-30 h-0 rail:top-0">
        {stubbyAskEnabled && past && !sheetOpen && (
          <button
            type="button"
            data-stubby-sticky=""
            onClick={backToStage}
            className="absolute inset-x-0 top-2 flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pl-2 pr-4 text-left text-small text-muted-foreground shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StubbyBuddy ref={mini} size={STICKY} rest="ready" waiting={ask.busy} className="shrink-0" />
            <span className="min-w-0 truncate">{ask.busy ? STUBBY_LINES.looking : ASK_COPY.sticky}</span>
          </button>
        )}
      </div>

      <section
        ref={stage}
        // With Ask Stubby off (config.ts) he has no field or line, so the stage isn't named for it.
        aria-label={stubbyAskEnabled ? ASK_COPY.button : undefined}
        data-stubby-stage=""
        className="mb-6 grid scroll-mt-[calc(var(--safe-top)+80px)] grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3 gap-y-4 rail:scroll-mt-4 tab:grid-cols-[112px_minmax(0,1fr)] tab:gap-x-6"
      >
        <div
          className="relative col-start-1 row-start-1 flex justify-center pb-2 tab:row-span-2"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") eager();
          }}
        >
          {/* His ground: a soft oval he stands on. No card or circle behind him: he is part of the page. */}
          <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-full bg-[var(--stubby-ink)] opacity-20 blur-[2px]" />
          {ring && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ ...page, duration: page.duration * 3 }}
              onAnimationComplete={() => setRing(false)}
            />
          )}
          <StubbyBuddy ref={buddy} size={size} rest="ready" waiting={loading || ask.busy} upset={failed} followPointer={finePointer} className="relative" />
        </div>

        {/* His line, in a bubble pointing at him. Screen readers read the words; Stubby himself is hidden.
            With Ask Stubby off, every line invites an ask, so he only reacts and says nothing. */}
        {stubbyAskEnabled && <div className="relative col-start-2 row-start-1 w-fit max-w-full self-center justify-self-start">
          <span aria-hidden="true" className="absolute left-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card" />
          <p aria-live="polite" data-stubby-line="" className="relative rounded-card border border-border bg-card px-4 py-3 text-lead font-semibold leading-snug">
            {line}
          </p>
        </div>}

        <div className="col-span-2 row-start-2 flex flex-col gap-4 tab:col-span-1 tab:col-start-2">
          {access.guest && (
            <div className="flex justify-end">
              <GuestSignUpButton />
            </div>
          )}
          {stubbyAskEnabled && ask.showContext && !access.closed && <ContextCard onDone={(t) => void ask.saveContext(t)} onSkip={ask.skipContext} />}
          {/* When his line already asks "What are you in the mood for?", the label isn't shown twice. */}
          {stubbyAskEnabled && <AskStubby state={ask} inputId={inputId} onFieldFocus={eager} hideLabel={line === ASK_COPY.label} />}
        </div>
      </section>

      {access.guest && <SignUpSheet />}
      {stubbyAskEnabled && <StubbyResults
        state={ask}
        onMakePlans={onMakePlans}
        onBring={onBring}
        onTryDifferent={() => {
          const field = document.getElementById(inputId) as HTMLInputElement | null;
          field?.focus();
          field?.select();
        }}
      />}
      {stubbyAskEnabled && access.guest && <InlineSignUpCard perDay={ask.accountPerDay} />}
      {!access.guest && ask.offerBirthday && (
        <AdultPrompt onAdded={ask.birthdayAdded} />
      )}
    </>
  );
});
