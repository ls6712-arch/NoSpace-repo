import { describe, expect, it } from "vitest";
import { Sparkles } from "lucide-react";
import { badges } from "../data/badges";
import { BADGE_ICONS, badgeIcon } from "./badgeIcon";

describe("badgeIcon", () => {
  it("has an icon for every badge", () => {
    const missing = badges.filter((b) => !BADGE_ICONS[b.icon]).map((b) => `${b.id}: ${b.icon}`);
    expect(missing).toEqual([]);
  });

  it("falls back to Sparkles for an unknown name", () => {
    expect(badgeIcon("NotAnIcon")).toBe(Sparkles);
  });
});
