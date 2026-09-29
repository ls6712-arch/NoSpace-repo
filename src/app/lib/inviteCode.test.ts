import { describe, expect, it } from "vitest";
import { formatInviteCodeInput, rawInviteCode } from "./inviteCode";

describe("formatInviteCodeInput", () => {
  it("uppercases and hyphenates after the 4th character", () => {
    expect(formatInviteCodeInput("v6nx6pj3")).toBe("V6NX-6PJ3");
  });

  it("leaves a short prefix unhyphenated", () => {
    expect(formatInviteCodeInput("v6n")).toBe("V6N");
    expect(formatInviteCodeInput("v6nx")).toBe("V6NX");
  });

  it("strips anything that isn't a letter or digit, including a hyphen already there", () => {
    expect(formatInviteCodeInput("v6nx-6pj3")).toBe("V6NX-6PJ3");
    expect(formatInviteCodeInput("v6nx 6pj3")).toBe("V6NX-6PJ3");
  });

  it("caps at 8 real characters", () => {
    expect(formatInviteCodeInput("v6nx6pj3extra")).toBe("V6NX-6PJ3");
  });
});

describe("rawInviteCode", () => {
  it("lowercases and drops the hyphen", () => {
    expect(rawInviteCode("V6NX-6PJ3")).toBe("v6nx6pj3");
  });

  it("round-trips through formatInviteCodeInput", () => {
    const typed = formatInviteCodeInput("V6NX6PJ3");
    expect(rawInviteCode(typed)).toBe("v6nx6pj3");
  });
});

// saveInviteCode/takeSavedInviteCode wrap window.localStorage directly, same
// as this codebase's other storage helpers (lib/localData.ts) — none of
// which have unit tests either, since the test environment here is plain
// Node with no window/localStorage global to exercise them against.
