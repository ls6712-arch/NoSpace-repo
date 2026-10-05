import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { Loader2 } from "lucide-react";
import { cn } from "./utils";
import { useDelayedFlag } from "./skeleton";
import { BUSY_LABEL } from "../../lib/stateCopy";

/** Below this width a busy button shows only the spinner, not "One sec…". */
const MIN_WIDTH_FOR_BUSY_LABEL = 88;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-small font-medium select-none transition-[color,background-color,border-color,box-shadow,filter,scale] duration-fast ease-standard active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The filled accent primary (docs/CLAUDE-redesign-brief.md §3.1) —
        // one accent color, no glow, no gradient. brand/coral point at the
        // same styling: under the single-accent warm-editorial palette
        // there's no more "violet system vs. Sushii's own warmth" to
        // distinguish between (that distinction was the retired violet/
        // gradient identity). Kept as separate variant names rather than
        // deleted so call sites don't need a mechanical rename here —
        // Task B decides screen by screen whether a given brand/coral call
        // site should collapse onto plain `default` instead.
        default: "bg-accent text-accent-foreground hover:brightness-110 active:brightness-95",
        brand: "bg-accent text-accent-foreground hover:brightness-110 active:brightness-95",
        coral: "bg-accent text-accent-foreground hover:brightness-110 active:brightness-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:brightness-95 focus-visible:ring-destructive/20",
        // Text button secondary (brief §3.1) — a hairline border, no fill.
        outline:
          "border border-input bg-transparent text-foreground hover:bg-accent/10 hover:border-accent/50 active:bg-accent/15",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:brightness-95",
        ghost: "hover:bg-surface-muted hover:text-foreground active:bg-surface-muted",
        link: "text-accent underline-offset-4 hover:underline active:opacity-75",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-7 has-[>svg]:px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  onClick,
  disabled,
  busy: busyProp = false,
  busyLabel = BUSY_LABEL,
  children,
  style,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Set while a save this button started is in flight (e.g. a form's
     * submit button). Async onClick handlers get this for free. */
    busy?: boolean;
    /** Label shown beside the spinner; null for spinner only. */
    busyLabel?: string | null;
  }) {
  const Comp = asChild ? Slot : "button";

  // An async onClick (anything that returns a promise: a save, a join, an
  // invite) disables the button until it settles, so a double tap can't
  // send the same write twice. The ref catches a second tap that lands
  // before React has re-rendered the button disabled.
  const pending = React.useRef(false);
  const [clickBusy, setClickBusy] = React.useState(false);
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (pending.current) {
        e.preventDefault();
        return;
      }
      const result = (onClick as ((e: React.MouseEvent<HTMLButtonElement>) => unknown) | undefined)?.(e);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        pending.current = true;
        setClickBusy(true);
        const done = () => {
          pending.current = false;
          setClickBusy(false);
        };
        (result as Promise<unknown>).then(done, (err: unknown) => {
          done();
          console.error(err);
        });
      }
    },
    [onClick],
  );

  const busy = busyProp || clickBusy;
  // Disabled at once; the spinner only appears if the wait passes 150ms,
  // so a quick save doesn't flicker.
  const showBusy = useDelayedFlag(busy) && !asChild;

  // Keep the button's width while it's busy, so swapping the label for the
  // spinner never nudges the layout around it.
  const ref = React.useRef<HTMLButtonElement>(null);
  const [lockedWidth, setLockedWidth] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    if (showBusy && ref.current) setLockedWidth(ref.current.getBoundingClientRect().width);
    if (!showBusy) setLockedWidth(null);
  }, [showBusy]);

  const iconOnly = size === "icon";
  const withLabel = !iconOnly && busyLabel != null && (lockedWidth ?? 0) >= MIN_WIDTH_FOR_BUSY_LABEL;

  return (
    <Comp
      data-slot="button"
      ref={asChild ? undefined : ref}
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={onClick ? handleClick : undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      style={lockedWidth != null ? { ...style, width: lockedWidth } : style}
      {...props}
    >
      {showBusy && lockedWidth != null ? (
        <>
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {withLabel ? <span>{busyLabel}</span> : <span className="sr-only">{busyLabel ?? BUSY_LABEL}</span>}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
