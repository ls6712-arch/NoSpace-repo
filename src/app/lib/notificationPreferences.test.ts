import { describe, expect, it } from "vitest";
import {
  circleInvitesEnabled,
  isCategoryMuted,
  withCircleInvitesEnabled,
  withMutedCategory,
} from "./notificationPreferences";

// A realistic full row — the Phase 6 email keys already shipped
// (20260919230000_pause_deletion_foundation.sql) alongside circle_invites,
// plus a Phase 5 muted array.
const FULL_PREFS = {
  circle_invites: true,
  replies_to_my_moments: true,
  circle_updates_joined: false,
  weekly_digest: false,
  product_news: false,
  muted: ["thoughts"],
};

describe("isCategoryMuted / mutedCategories", () => {
  it("is false for a missing settings row (empty object)", () => {
    expect(isCategoryMuted({}, "thoughts")).toBe(false);
  });

  it("is false when muted is present but doesn't include the category", () => {
    expect(isCategoryMuted(FULL_PREFS, "pursuit_activity")).toBe(false);
  });

  it("is true when the category is in the muted array", () => {
    expect(isCategoryMuted(FULL_PREFS, "thoughts")).toBe(true);
  });

  it("tolerates a malformed muted value (wrong type) instead of throwing", () => {
    expect(isCategoryMuted({ muted: "not-an-array" }, "thoughts")).toBe(false);
    expect(isCategoryMuted({ muted: [1, 2, "thoughts"] }, "thoughts")).toBe(true);
  });
});

describe("withMutedCategory", () => {
  it("adds a category without duplicating an already-present one", () => {
    const next = withMutedCategory(FULL_PREFS, "thoughts", true);
    expect(next.muted).toEqual(["thoughts"]);
  });

  it("adds a genuinely new category alongside the existing one", () => {
    const next = withMutedCategory(FULL_PREFS, "message_requests", true);
    expect(next.muted).toEqual(["thoughts", "message_requests"]);
  });

  it("removes a category, leaving the rest", () => {
    const withTwo = withMutedCategory(FULL_PREFS, "message_requests", true);
    const next = withMutedCategory(withTwo, "thoughts", false);
    expect(next.muted).toEqual(["message_requests"]);
  });

  it("preserves every other key untouched — circle_invites and every Phase 6 email key", () => {
    const next = withMutedCategory(FULL_PREFS, "pursuit_activity", true);
    expect(next.circle_invites).toBe(true);
    expect(next.replies_to_my_moments).toBe(true);
    expect(next.circle_updates_joined).toBe(false);
    expect(next.weekly_digest).toBe(false);
    expect(next.product_news).toBe(false);
  });

  it("builds a fresh muted array from an empty settings object", () => {
    const next = withMutedCategory({}, "thoughts", true);
    expect(next.muted).toEqual(["thoughts"]);
  });
});

describe("circleInvitesEnabled / withCircleInvitesEnabled", () => {
  it("is true (on) for a missing settings row", () => {
    expect(circleInvitesEnabled({})).toBe(true);
  });

  it("is true when explicitly true", () => {
    expect(circleInvitesEnabled({ circle_invites: true })).toBe(true);
  });

  it("is false only when explicitly false", () => {
    expect(circleInvitesEnabled({ circle_invites: false })).toBe(false);
  });

  it("toggling circle_invites never touches the muted array or other keys", () => {
    const next = withCircleInvitesEnabled(FULL_PREFS, false);
    expect(next.circle_invites).toBe(false);
    expect(next.muted).toEqual(["thoughts"]);
    expect(next.replies_to_my_moments).toBe(true);
    expect(next.weekly_digest).toBe(false);
  });
});
