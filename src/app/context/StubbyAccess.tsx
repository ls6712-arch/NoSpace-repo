import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { ensureGuestSession, guestSession, guestSupabase, turnstileSiteKey } from "../../lib/guestSupabase";
import { track, type SignUpTrigger } from "../lib/analytics";
import { turnstileToken } from "../lib/turnstile";
import type { AskLimit } from "../lib/stubbyAsk";

/** What a guest tried that needs an account. */
export type GateFeature = "plan" | "calendar" | "more" | "keep";

/** The one sign-up prompt on screen, if any (never two at once). */
export type ActivePrompt = { kind: "inline_card" } | { kind: "limit"; limit: AskLimit } | { kind: "sheet"; trigger: SignUpTrigger; feature: GateFeature | null };

export interface StubbyAccess {
  /** Signed out: Stubby runs as a guest, through the guest's own client. */
  guest: boolean;
  /** The client Stubby reads and asks through. */
  client: SupabaseClient | null;
  /** Makes the guest on the first ask (with Turnstile when it is on). True when there is a session. */
  ensureSession: () => Promise<boolean>;
  prompt: ActivePrompt | null;
  /** After the guest's 3rd ask: the inline card, if the frequency rules allow it. */
  offerInlineCard: () => void;
  /** The limit (or the guest cap) stopped an ask: the composer gives way to the limit panel. */
  showLimit: (limit: AskLimit) => void;
  /** An account-only action: the sign-up sheet, naming it. */
  gate: (feature: GateFeature) => void;
  /** The sign-up sheet, from the header button, the inline card or the limit panel. */
  openSignUp: (trigger: SignUpTrigger) => void;
  /** Closes whatever prompt is open; the inline card's dismissal is remembered for 7 days. */
  dismiss: () => void;
  /** How many asks the guest has made this session (for the 3rd-ask card and signup_completed). */
  guestMessages: number;
  noteAsk: () => number;
  /** The ask in the field when a prompt opened, kept for after sign-up. */
  draft: React.MutableRefObject<string>;
}

const INLINE_SEEN_KEY = "soosh.stubby.inlineCard.session.v1";
const INLINE_DISMISSED_KEY = "soosh.stubby.inlineCard.dismissedUntil.v1";
const GUEST_ASKS_KEY = "soosh.stubby.guestAsks.v1";
const WEEK_MS = 7 * 86_400_000;

const read = (store: "local" | "session", key: string): string | null => {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
};
const write = (store: "local" | "session", key: string, value: string) => {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Storage blocked: the rule holds for this page only.
  }
};

/** Whether the inline card may show now: once a session, and not within 7 days of a dismissal. */
export function inlineCardAllowed(now = Date.now()): boolean {
  if (read("session", INLINE_SEEN_KEY)) return false;
  const until = Number(read("local", INLINE_DISMISSED_KEY) ?? 0);
  return !(Number.isFinite(until) && until > now);
}

const MEMBER_ACCESS: StubbyAccess = {
  guest: false,
  client: supabase,
  ensureSession: async () => true,
  prompt: null,
  offerInlineCard: () => undefined,
  showLimit: () => undefined,
  gate: () => undefined,
  openSignUp: () => undefined,
  dismiss: () => undefined,
  guestMessages: 0,
  noteAsk: () => 0,
  draft: { current: "" },
};

const Ctx = createContext<StubbyAccess>(MEMBER_ACCESS);

/** Stubby's access for this page: a member (no prompts ever) unless the provider says guest. */
export function useStubbyAccess(): StubbyAccess {
  return useContext(Ctx);
}

export function StubbyAccessProvider({ guest, children }: { guest: boolean; children: ReactNode }) {
  const [prompt, setPrompt] = useState<ActivePrompt | null>(null);
  const [guestMessages, setGuestMessages] = useState(() => Number(read("session", GUEST_ASKS_KEY) ?? 0) || 0);
  const draft = useRef("");
  const shown = useRef<SignUpTrigger | null>(null);
  /** The limit stays until it resets: closing the sheet opened from it goes back to it. */
  const lastLimit = useRef<AskLimit | null>(null);

  // One event per prompt shown.
  useEffect(() => {
    if (!prompt) return;
    const trigger: SignUpTrigger = prompt.kind === "sheet" ? prompt.trigger : prompt.kind;
    if (shown.current === trigger) return;
    shown.current = trigger;
    track({ name: "signup_prompt_shown", trigger });
  }, [prompt]);

  const ensureSession = useCallback(async () => {
    if (!guest) return true;
    if (await guestSession()) return true;
    const token = await turnstileToken(turnstileSiteKey);
    return (await ensureGuestSession(token)).ok;
  }, [guest]);

  const offerInlineCard = useCallback(() => {
    if (!guest || !inlineCardAllowed()) return;
    setPrompt((p) => {
      if (p) return p; // Never two at once.
      write("session", INLINE_SEEN_KEY, "1");
      return { kind: "inline_card" };
    });
  }, [guest]);

  const showLimit = useCallback(
    (limit: AskLimit) => {
      if (!guest) return;
      lastLimit.current = limit;
      setPrompt((p) => (p?.kind === "sheet" ? p : { kind: "limit", limit }));
    },
    [guest],
  );

  const gate = useCallback(
    (feature: GateFeature) => {
      if (!guest) return;
      setPrompt({ kind: "sheet", trigger: "feature_gate", feature });
    },
    [guest],
  );

  const openSignUp = useCallback(
    (trigger: SignUpTrigger) => {
      if (!guest) return;
      setPrompt({ kind: "sheet", trigger, feature: null });
    },
    [guest],
  );

  const dismiss = useCallback(() => {
    setPrompt((p) => {
      if (!p) return p;
      const trigger: SignUpTrigger = p.kind === "sheet" ? p.trigger : p.kind;
      track({ name: "signup_prompt_dismissed", trigger });
      if (p.kind === "inline_card") write("local", INLINE_DISMISSED_KEY, String(Date.now() + WEEK_MS));
      shown.current = null;
      // The limit panel isn't dismissed (sending stays blocked until it resets); closing the
      // sheet goes back to it.
      if (p.kind === "limit") return p;
      if (lastLimit.current && (lastLimit.current.resetsAt === null || lastLimit.current.resetsAt > Date.now())) return { kind: "limit", limit: lastLimit.current };
      return null;
    });
  }, []);

  const noteAsk = useCallback(() => {
    let n = 0;
    setGuestMessages((m) => {
      n = m + 1;
      write("session", GUEST_ASKS_KEY, String(n));
      return n;
    });
    return n;
  }, []);

  const value = useMemo<StubbyAccess>(
    () =>
      guest
        ? { guest: true, client: guestSupabase, ensureSession, prompt, offerInlineCard, showLimit, gate, openSignUp, dismiss, guestMessages, noteAsk, draft }
        : MEMBER_ACCESS,
    [guest, ensureSession, prompt, offerInlineCard, showLimit, gate, openSignUp, dismiss, guestMessages, noteAsk],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
