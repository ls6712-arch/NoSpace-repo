// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { toGaParams, track } from "./analytics";
import { signInEvent } from "./signInEvent";

describe("toGaParams", () => {
  it("drops ids and snake_cases the rest", () => {
    expect(toGaParams({ name: "pursuit_share_opened", pursuitId: "abc", from: "pursuit_page" })).toEqual({
      from: "pursuit_page",
    });
    expect(toGaParams({ name: "moment_double_tap_loved", postId: 12 })).toEqual({});
    expect(toGaParams({ name: "discover_for_you_personalized", signalCount: 3 })).toEqual({ signal_count: 3 });
    expect(toGaParams({ name: "calendar_filter_changed", row: "plans", on: true })).toEqual({ row: "plans", on: true });
  });
});

describe("track", () => {
  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("sends to gtag when GA is loaded", () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtag;
    track({ name: "home_suggestion_opened", kind: "class", position: 2 });
    expect(gtag).toHaveBeenCalledWith("event", "home_suggestion_opened", { kind: "class", position: 2 });
  });

  it("does nothing without GA", () => {
    expect(() => track({ name: "undo_used" })).not.toThrow();
  });
});

describe("signInEvent", () => {
  const now = Date.parse("2026-11-02T15:00:00Z");
  it("calls a fresh account a sign-up", () => {
    expect(signInEvent({ created_at: "2026-11-02T14:58:00Z", app_metadata: { provider: "google" } }, now)).toEqual({
      name: "sign_up",
      method: "google",
    });
  });
  it("calls an older account a log-in", () => {
    expect(signInEvent({ created_at: "2026-10-01T00:00:00Z", app_metadata: {} }, now)).toEqual({
      name: "login",
      method: "email",
    });
  });
});
