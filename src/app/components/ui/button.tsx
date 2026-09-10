import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The restrained-glow primary action: ink-on-violet text (white only
        // clears 3.38:1 on --violet-electric, short of AA; ink-on-violet
        // clears 5.89:1), a hairline violet ring, and a soft glow that only
        // shows up on hover/focus — "restrained," not every button glowing.
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(166,108,255,0.35)] transition-shadow hover:shadow-[0_0_0_1px_rgba(166,108,255,0.5),0_0_24px_-4px_rgba(166,108,255,0.55)] active:brightness-95",
        brand:
          "text-white shadow-[0_0_0_1px_rgba(166,108,255,0.3),0_10px_28px_-10px_rgba(166,108,255,0.6)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] [background-image:var(--gradient-brand)]",
        // The warm action, kept for places that want NoSpace's human warmth
        // rather than the violet system's own accent (--coral-deep clears
        // 5.15:1 with white).
        coral:
          "text-white shadow-sm [background-color:var(--coral-deep)] hover:brightness-110 active:brightness-95",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        // Secondary action: near-transparent dark surface with a subtle
        // violet-tinted border, brightening slightly on hover — never a
        // flat white/light surface.
        outline:
          "border border-input bg-[color-mix(in_srgb,var(--void)_35%,transparent)] text-foreground hover:bg-accent/10 hover:border-accent/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-surface-muted hover:text-foreground",
        link: "text-[var(--violet-electric-bright)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-full px-7 has-[>svg]:px-5",
        icon: "size-9 rounded-full",
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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
