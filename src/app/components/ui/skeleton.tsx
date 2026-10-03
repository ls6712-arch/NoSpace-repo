import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "./utils";

/**
 * A grey placeholder block. Shapes are built from these to match the real
 * component's box exactly (same heights, same paddings), so nothing jumps
 * when data arrives. Pulses gently; holds still under reduced motion.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)] animate-pulse motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

/** How long a load has to run before a skeleton appears. Fast loads never flash one. */
export const SKELETON_DELAY_MS = 150;

/**
 * True only once `active` has stayed true for `delayMs`. Drops back to false
 * the moment `active` does.
 */
export function useDelayedFlag(active: boolean, delayMs = SKELETON_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [active, delayMs]);
  return active && shown;
}

/**
 * Wraps a loading region: the skeleton holds its space from the first
 * frame but stays invisible for the first 150ms (so fast loads don't
 * flash and nothing below shifts), then shows, then the real content
 * replaces it. Screen readers hear one "busy" region.
 */
export function Loadable({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const show = useDelayedFlag(loading);
  if (!loading) return <>{children}</>;
  return (
    <div aria-busy="true" className={cn(!show && "invisible", className)}>
      {skeleton}
    </div>
  );
}
