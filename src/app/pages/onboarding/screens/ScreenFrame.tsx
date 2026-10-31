import type { ReactNode } from "react";

/**
 * The shared shape of an onboarding screen: an optional hero, one headline,
 * a line of help, the one thing being asked, and the action pinned to the bottom.
 */
export function ScreenFrame({
  title,
  intro,
  hero,
  children,
  footer,
  stickyFooter = false,
  display = false,
}: {
  title: string;
  intro?: ReactNode;
  hero?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Keeps the footer on screen over a long list (the Corners to pick from). */
  stickyFooter?: boolean;
  /** The welcome headline: the largest display step instead of the title step. */
  display?: boolean;
}) {
  return (
    <section className={stickyFooter ? "flex flex-1 flex-col" : "flex flex-1 flex-col pb-6"}>
      {hero && <div className="flex flex-1 items-center justify-center pt-8">{hero}</div>}
      {!hero && <div className={stickyFooter ? "h-2" : "h-6"} />}
      <h1 className={`mt-4 break-words ${display ? "text-display" : "text-title"}`}>{title}</h1>
      {intro && <p className="mt-3 text-body ob-muted">{intro}</p>}
      {children && <div className="mt-6 flex flex-col gap-4">{children}</div>}
      {footer && (
        <div className={stickyFooter ? "ob-sticky-footer mt-auto flex flex-col gap-3 pt-6" : "mt-auto flex flex-col gap-3 pt-8"}>{footer}</div>
      )}
    </section>
  );
}
