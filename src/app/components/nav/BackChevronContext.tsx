import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

/**
 * "plain": on the page background. "onMedia": over a hero photo, so the icon
 * sits on a small translucent circle and reads on any image.
 */
export type BackChevronVariant = "plain" | "onMedia";

interface Ctx {
  variant: BackChevronVariant;
  setVariant: (v: BackChevronVariant) => void;
}

const BackChevronContext = createContext<Ctx>({ variant: "plain", setVariant: () => undefined });

export function BackChevronProvider({ children }: { children: ReactNode }) {
  const [variant, setVariant] = useState<BackChevronVariant>("plain");
  const value = useMemo(() => ({ variant, setVariant }), [variant]);
  return <BackChevronContext.Provider value={value}>{children}</BackChevronContext.Provider>;
}

export function useBackChevronState(): BackChevronVariant {
  return useContext(BackChevronContext).variant;
}

/**
 * A page with a hero photo calls this so the shell's chevron floats over the
 * photo. It goes back to "plain" when the page goes away. The shell draws the
 * chevron; a page never draws its own.
 */
export function useBackChevronVariant(variant: BackChevronVariant): void {
  const { setVariant } = useContext(BackChevronContext);
  useLayoutEffect(() => {
    setVariant(variant);
    return () => setVariant("plain");
  }, [variant, setVariant]);
}
