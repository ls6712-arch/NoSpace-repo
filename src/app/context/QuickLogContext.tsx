import { createContext, useContext, useState, ReactNode } from "react";

interface QuickLogContextType {
  open: boolean;
  openQuickLog: () => void;
  closeQuickLog: () => void;
}

const QuickLogContext = createContext<QuickLogContextType | undefined>(undefined);

/**
 * Whether the global two-tap composer (QuickLogGlobalSheet, mounted once in
 * Root.tsx next to CartDrawer) is open — just the open/close bit, kept
 * separate from QuickLog.tsx itself so the bottom tab bar and any other
 * "+"-style entry point can trigger it without needing to know anything
 * about Pursuits, Corners, or how a Moment actually gets saved.
 */
export function QuickLogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <QuickLogContext.Provider
      value={{ open, openQuickLog: () => setOpen(true), closeQuickLog: () => setOpen(false) }}
    >
      {children}
    </QuickLogContext.Provider>
  );
}

export function useQuickLog() {
  const ctx = useContext(QuickLogContext);
  if (!ctx) throw new Error("useQuickLog must be used within a QuickLogProvider");
  return ctx;
}
