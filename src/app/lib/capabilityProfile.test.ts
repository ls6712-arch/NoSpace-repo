import { expect, it } from "vitest";
import { emptyCapability, parseCapability } from "./capabilityProfile";
it("starts with every memory permission disabled", () => {
  expect(parseCapability(emptyCapability()).consent).toEqual({ memory: false, onboarding: false, feedback: false });
});
it("keeps explicit preferences typed and rejects forged verification or unknown keys", () => {
  expect(parseCapability({ ...emptyCapability(), equipment: [" guitar ", "guitar"] }).equipment).toEqual(["guitar"]);
  for (const bad of [ { ...emptyCapability(), user_id: "bob" }, { ...emptyCapability(), timeZone: "bad/time" }, { ...emptyCapability(), perActivityBudget: -1 }, { ...emptyCapability(), memberships: [{ name: "Museum", expiresOn: null, status: "verified" }] } ]) expect(() => parseCapability(bad)).toThrow();
});
it("validates expiry dates without silently fixing impossible dates", () => {
  expect(() => parseCapability({ ...emptyCapability(), memberships: [{ name: "Museum", expiresOn: "2026-02-31", status: "self_reported" }] })).toThrow();
});

import { describe } from "vitest";
import { capabilityProfileFromTaste, resolveCapabilityContext } from "./capabilityProfile";

describe("Personal Capability Profile", () => {
  const profile = capabilityProfileFromTaste({
    windows: ["sat-day"],
    monthlyBudget: 200,
    passes: [{ id: "gym-1", kind: "gym", label: "Local gym" }],
    picks: ["art/painting"],
    updatedAtUtc: "2026-11-03T12:00:00Z",
  });

  it("preserves existing onboarding data without claiming verified eligibility", () => {
    expect(profile.freeWindows).toEqual(["sat-day"]);
    expect(profile.monthlyBudget).toBe(200);
    expect(profile.capabilities[0].verification).toBe("self_reported");
  });
  it("does not mistake monthly budget for an activity limit", () => {
    expect(resolveCapabilityContext(profile, {}, "2026-11-03T12:00:00Z").budgetLimit).toBeNull();
  });
  it("uses explicit request budget without mutating the profile", () => {
    expect(resolveCapabilityContext(profile, { budgetLimit: 0 }, "2026-11-03T12:00:00Z").budgetLimit).toBe(0);
    expect(profile.perActivityBudget).toBeNull();
  });
  it("filters expired access without deleting the stored record", () => {
    const withExpiry = { ...profile, capabilities: [{ ...profile.capabilities[0], expiresAtUtc: "2026-11-02T00:00:00Z" }] };
    expect(resolveCapabilityContext(withExpiry, {}, "2026-11-03T12:00:00Z").capabilities).toEqual([]);
    expect(withExpiry.capabilities).toHaveLength(1);
  });
  it("rejects invalid budget", () => {
    expect(() => resolveCapabilityContext(profile, { budgetLimit: -1 })).toThrow();
  });
});
