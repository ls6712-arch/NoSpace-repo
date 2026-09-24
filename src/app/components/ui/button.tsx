import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn text-sm font-medium transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
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
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
        // Text button secondary (brief §3.1) — a hairline border, no fill.
        outline:
          "border border-input bg-transparent text-foreground hover:bg-accent/10 hover:border-accent/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-surface-muted hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
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
