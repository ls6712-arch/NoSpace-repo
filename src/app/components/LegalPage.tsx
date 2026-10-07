import type { ReactNode } from "react";
import { Link } from "react-router";
import { APP_NAME } from "../config";

/**
 * Shared layout for /terms and /privacy-policy (landing page spec §2.5).
 * Both pages are drafts — see each page's own file for the "Draft for
 * review" note and the placeholders a lawyer and Sush still need to fill
 * in before launch.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-12 lg:py-section-hero">
      <h1 className="mb-2 text-display" style={{ fontFamily: "var(--font-serif)" }}>
        {title}
      </h1>
      <p className="mb-10 text-caption text-muted-foreground">Last updated {lastUpdated}</p>
      <div className="text-body leading-relaxed text-foreground [&>h2]:mb-3 [&>h2]:mt-10 [&>h2]:text-title [&>p]:mb-4">
        {children}
      </div>
      <Link to="/" className="mt-12 inline-block text-small text-muted-foreground hover:text-foreground">
        ← Back to {APP_NAME}
      </Link>
    </div>
  );
}
