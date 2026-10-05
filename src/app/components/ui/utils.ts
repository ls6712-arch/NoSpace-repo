import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the project's token utilities (src/styles/theme.css).
// Without this it reads `text-caption` as a text *colour* and silently drops
// an earlier `text-accent-foreground`, and it never sees `rounded-card` /
// `rounded-control`, `shadow-card`, `duration-fast` as conflicting with the
// stock sizes a component's base classes set.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "small", "body", "lead", "title", "display", "hero"] }],
      rounded: [{ rounded: ["card", "control"] }],
      shadow: [{ shadow: ["card", "overlay"] }],
      duration: [{ duration: ["fast", "base"] }],
      ease: [{ ease: ["standard"] }],
      h: [{ h: ["viewport"] }],
      "min-h": [{ "min-h": ["viewport"] }],
      "bg-image": [{ bg: ["scrim"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
