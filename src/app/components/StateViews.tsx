import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { LOAD_ERROR_LINE, TRY_AGAIN } from "../lib/stateCopy";

type Action =
  | { label: string; to: string; onClick?: never }
  | { label: string; onClick: () => void; to?: never };

/**
 * The one empty-state pattern: a short line, an optional one-line hint,
 * and one next step. Never a dead end.
 *
 * Writing it: the line says what's empty in sentence case with a period
 * ("No Moments here yet."); the hint says what fills it; the action is
 * a glossary verb ("Log a Moment", "Browse Spaces", "Start a Pursuit").
 *
 * `size="rail"` is for a narrow sidebar section (left-aligned, link-style
 * action); `"inline"` is for a slot inside a card or dialog; `"section"`
 * (default) is the dashed box used for a page section; `"page"` is a
 * first-run screen with an icon and a serif headline.
 */
export function EmptyState({
  line,
  hint,
  action,
  icon,
  size = "section",
  className,
}: {
  line: string;
  hint?: ReactNode;
  action?: Action;
  icon?: ReactNode;
  size?: "rail" | "inline" | "section" | "page";
  className?: string;
}) {
  if (size === "rail") {
    const linkClass = "text-xs text-accent hover:underline";
    return (
      <div data-slot="empty-state" className={cn("mt-3", className)}>
        <p className="text-sm text-muted-foreground">
          {line}
          {hint ? <> {hint}</> : null}
        </p>
        {action &&
          (action.to ? (
            <Link to={action.to} className={cn("mt-1 inline-block", linkClass)}>
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className={cn("mt-1", linkClass)}>
              {action.label}
            </button>
          ))}
      </div>
    );
  }

  const button =
    action &&
    (action.to ? (
      <Button asChild variant={size === "page" ? "coral" : "outline"} size={size === "page" ? "default" : "sm"}>
        <Link to={action.to}>{action.label}</Link>
      </Button>
    ) : (
      <Button
        variant={size === "page" ? "coral" : "outline"}
        size={size === "page" ? "default" : "sm"}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    ));

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "text-center",
        size === "inline" && "py-6",
        size === "section" && "rounded-2xl border border-dashed border-border px-5 py-9",
        size === "page" && "rounded-2xl border border-dashed border-border px-5 py-14",
        className,
      )}
    >
      {icon && size === "page" && (
        <span
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-surface-muted text-foreground [&_svg]:size-6"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {size === "page" ? (
        <h2 className="mb-2 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          {line}
        </h2>
      ) : (
        <p className="mx-auto max-w-sm text-sm text-foreground">{line}</p>
      )}
      {hint && (
        <p
          className={cn(
            "mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground",
            size === "page" ? "mb-6" : "mt-1",
          )}
        >
          {hint}
        </p>
      )}
      {button && <div className={size === "page" ? "" : "mt-4"}>{button}</div>}
    </div>
  );
}

/**
 * A load or save that failed: the one error line plus a retry. Inline
 * (in place of the content that didn't arrive), never a raw message.
 */
export function ErrorNotice({
  message = LOAD_ERROR_LINE,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void | Promise<void>;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("py-6 text-center", className)}>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {TRY_AGAIN}
        </Button>
      )}
    </div>
  );
}

/** A save error under a form: the line plus an optional retry link. */
export function InlineError({
  message,
  onRetry,
  className,
}: {
  message: string | null | undefined;
  onRetry?: () => void;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-xs text-[var(--coral-text)]", className)}>
      {message}
      {onRetry && (
        <>
          {" "}
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
            {TRY_AGAIN}
          </button>
        </>
      )}
    </p>
  );
}
