import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn (tailwind-merge knows the token utilities)", () => {
  it("keeps a text colour next to a token font size, in either order", () => {
    expect(cn("text-accent-foreground", "text-caption")).toBe("text-accent-foreground text-caption");
    expect(cn("text-caption", "text-accent-foreground")).toBe("text-caption text-accent-foreground");
    expect(cn("text-foreground", "text-hero")).toBe("text-foreground text-hero");
  });
  it("lets a token size replace a stock or token size", () => {
    expect(cn("text-sm", "text-caption")).toBe("text-caption");
    expect(cn("text-small", "text-body")).toBe("text-body");
  });
  it("lets token radius, shadow, motion and viewport utilities override the stock ones", () => {
    expect(cn("rounded-md", "rounded-card")).toBe("rounded-card");
    expect(cn("rounded-full", "rounded-control")).toBe("rounded-control");
    expect(cn("shadow-sm", "shadow-card")).toBe("shadow-card");
    expect(cn("duration-150", "duration-fast")).toBe("duration-fast");
    expect(cn("h-10", "h-viewport")).toBe("h-viewport");
  });
  it("treats bg-scrim (an image) and a bg colour as different properties", () => {
    expect(cn("bg-scrim", "bg-card")).toBe("bg-scrim bg-card");
  });
});
