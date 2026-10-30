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
}: {
  title: string;
  intro?: ReactNode;
  hero?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col pb-6">
      {hero && <div className="flex flex-1 items-center justify-center pt-8">{hero}</div>}
      {!hero && <div className="h-6" />}
      <h1 className="transfer-headline mt-4 break-words text-display">{title}</h1>
      {intro && <p className="mt-3 text-body transfer-muted">{intro}</p>}
      {children && <div className="mt-6 flex flex-col gap-4">{children}</div>}
      {footer && <div className="mt-auto flex flex-col gap-3 pt-8">{footer}</div>}
    </section>
  );
}
