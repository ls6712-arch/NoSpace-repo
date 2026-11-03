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
