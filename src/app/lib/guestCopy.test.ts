import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIRTHDAY_COPY, GUEST_COPY, outOfAsksLine } from "./guestCopy";

// The founder's rule (Nov 3, 2026): no number or time is written into a line. Each comes in as a
// value: allowances from the server, times from dates.ts in local time, ages from lib/age.ts.

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}
const SENTINEL = 7;
function called(v: unknown): string[] {
  if (typeof v === "function") return [(v as (...a: unknown[]) => string)(SENTINEL, "TIME")];
  if (v && typeof v === "object") return Object.values(v).flatMap(called);
  return [];
}

describe("guest and birthday copy", () => {
  it("no fixed line has a digit of its own", () => {
    for (const s of [...strings(GUEST_COPY), ...strings(BIRTHDAY_COPY)]) expect(s, s).not.toMatch(/\d/);
  });

  it("every number in a line comes from its argument", () => {
    for (const s of [...called(GUEST_COPY), ...called(BIRTHDAY_COPY), outOfAsksLine(SENTINEL)]) {
      expect(s.replace(String(SENTINEL), ""), s).not.toMatch(/\d/);
    }
  });

  it("the sign-up sheet's general line is the inline card's line (founder, Nov 3, 2026)", () => {
    expect(GUEST_COPY.gateKeep(6)).toBe(GUEST_COPY.inlineCard(6));
    expect(GUEST_COPY.inlineCard(6)).toBe("Sign up to keep your picks and get 6 asks a day.");
  });

  it("Finish setting up: the title stays, the button says Set up now", () => {
    expect(GUEST_COPY.finishTitle).toBe("Finish setting up");
    expect(GUEST_COPY.finishButton).toBe("Set up now");
  });

  it("nothing is left waiting for approval", () => {
    expect(readFileSync(new URL("./guestCopy.ts", import.meta.url), "utf8")).not.toMatch(/\bNEW\b/);
  });
});
