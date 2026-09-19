import * as React from "react";

import { cn } from "./utils";

/**
 * "N · EYEBROW" + serif title — docs/CLAUDE-redesign-brief.md §3.1's
 * section-header primitive. Extracted from the exact pattern
 * Settings.tsx's AppearanceSection already hand-wrote (`ns-section-kicker`
 * eyebrow line + a serif `<h2>`), so this doesn't invent a new look — it
 * just stops that markup being retyped at every call site.
 *
 * Deliberately plain (`text-muted-foreground`), not gold: gold is a tiny
 * detail only (brief §1), and a section header repeats on every screen —
 * making it gold by default here would turn a decorative accent into a
 * dominant, everywhere color. A one-off eyebrow that specifically wants
 * gold (e.g. My Space's own date eyebrow) sets its own color at the call
 * site rather than through this primitive's default.
 */
export function SectionHeader({
  n,
  eyebrow,
  title,
  as: Heading = "h2",
  className,
  titleClassName,
}: {
  /** The leading number, e.g. 1 for "1 · APPEARANCE". */
  n: number | string;
  eyebrow: string;
  title: React.ReactNode;
  /** Heading level — h1 for a page's own title, h2 for a section within it. */
  as?: "h1" | "h2" | "h3";
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <p className="ns-section-kicker mb-1 text-muted-foreground">
        {n} · {eyebrow}
      </p>
      <Heading
        className={cn("text-2xl", titleClassName)}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
      </Heading>
    </div>
  );
}
