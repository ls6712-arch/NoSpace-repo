import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BuddyReaction, StubbyBuddyHandle } from "./StubbyBuddy";

/**
 * The one Stubby in the corner (StubbyDock), shared with the page under him. A screen
 * opens the Ask Stubby panel with `openStubby()`, and has him react to what you did
 * there with `react()` (Calendar's Keep, Not this, Bring someone), so there is never a
 * second Stubby on a page.
 */
export interface StubbyDockApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  openStubby: () => void;
  react: (r: BuddyReaction) => void;
  buddy: RefObject<StubbyBuddyHandle>;
  /** An ask is running: he thinks. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Asks left today, once known. */
  asksLeft: number | null;
  setAsksLeft: (n: number) => void;
}

const noop = () => {};
const NO_DOCK: StubbyDockApi = {
  open: false,
  setOpen: noop,
  openStubby: noop,
  react: noop,
  buddy: { current: null },
  busy: false,
  setBusy: noop,
  asksLeft: null,
  setAsksLeft: noop,
};

const Ctx = createContext<StubbyDockApi>(NO_DOCK);

/** Without a provider (a test, a page outside the app shell) every call does nothing. */
export const useStubbyDock = () => useContext(Ctx);

export function StubbyDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asksLeft, setAsksLeft] = useState<number | null>(null);
  const buddy = useRef<StubbyBuddyHandle>(null);
  const openStubby = useCallback(() => setOpen(true), []);
  const react = useCallback((r: BuddyReaction) => buddy.current?.react(r), []);
  const value = useMemo<StubbyDockApi>(
    () => ({ open, setOpen, openStubby, react, buddy, busy, setBusy, asksLeft, setAsksLeft }),
    [open, openStubby, react, busy, asksLeft],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
