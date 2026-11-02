// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { inlineCardAllowed } from "../context/StubbyAccess";
import { linkErrorInUrl, peekReturn, RETURN_KEY, saveReturn, takeReturn } from "./signUpReturn";
import { cleanCityName, readLimit, tasteIsEmpty } from "./stubbyAsk";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("the inline sign-up card's frequency", () => {
  it("shows at most once a session", () => {
    expect(inlineCardAllowed()).toBe(true);
    window.sessionStorage.setItem("soosh.stubby.inlineCard.session.v1", "1");
    expect(inlineCardAllowed()).toBe(false);
  });

  it("stays away for 7 days once dismissed, then may come back", () => {
    const now = Date.UTC(2026, 10, 2);
    window.localStorage.setItem("soosh.stubby.inlineCard.dismissedUntil.v1", String(now + 7 * 86_400_000));
    expect(inlineCardAllowed(now + 6 * 86_400_000)).toBe(false);
    expect(inlineCardAllowed(now + 8 * 86_400_000)).toBe(true);
  });
});

describe("coming back after sign-up", () => {
  it("keeps the draft and the trigger for one read, then forgets them", () => {
    saveReturn({ trigger: "limit", method: "google", draft: "jazz tonight", blocked: true, guestMessages: 3 });
    expect(peekReturn()).toMatchObject({ trigger: "limit", method: "google", draft: "jazz tonight", blocked: true, guestMessages: 3, path: "/calendar" });
    expect(takeReturn()?.draft).toBe("jazz tonight");
    expect(takeReturn()).toBeNull();
  });

  it("drops anything stale, malformed or out of range, and never holds an id or a token", () => {
    saveReturn({ trigger: "header", method: "email", draft: "x".repeat(500), blocked: false, guestMessages: 1 });
    expect(peekReturn()!.draft).toHaveLength(200);
    expect(Object.keys(JSON.parse(window.sessionStorage.getItem(RETURN_KEY)!)).sort()).toEqual(["at", "blocked", "draft", "guestMessages", "method", "path", "trigger"]);
    expect(peekReturn(Date.now() + 31 * 60_000)).toBeNull();
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ trigger: "evil", method: "google", draft: "", at: Date.now() }));
    expect(peekReturn()).toBeNull();
    window.sessionStorage.setItem(RETURN_KEY, "{not json");
    expect(peekReturn()).toBeNull();
  });

  it("recognises a failed link because the Google account already has an account", () => {
    expect(linkErrorInUrl("https://www.onsoosh.com/#error=server_error&error_code=identity_already_exists&error_description=x")).toBe("identity_already_exists");
    expect(linkErrorInUrl("https://www.onsoosh.com/#error=access_denied")).toBe("other");
    expect(linkErrorInUrl("https://www.onsoosh.com/#/calendar")).toBeNull();
  });
});

describe("reading the server's refusals and the taste profile", () => {
  it("reads a limit code and reset time, and nothing else", () => {
    expect(readLimit({ code: "GUEST_LIMIT_REACHED", resetsAt: "2026-11-03T18:00:00Z" })).toEqual({ code: "GUEST_LIMIT_REACHED", resetsAt: Date.parse("2026-11-03T18:00:00Z") });
    expect(readLimit({ code: "GUEST_GLOBAL_CAP", resetsAt: null })).toEqual({ code: "GUEST_GLOBAL_CAP", resetsAt: null });
    expect(readLimit({ code: "DROP TABLE" })).toBeNull();
    expect(readLimit("429")).toBeNull();
  });

  it("keeps a city name only: never coordinates", () => {
    expect(cleanCityName("  Park Slope,   Brooklyn ")).toBe("Park Slope, Brooklyn");
    expect(cleanCityName("40.7128, -74.0060")).toBeNull();
    expect(tasteIsEmpty(null)).toBe(true);
    expect(tasteIsEmpty({ city: null, interests: [], timing: null })).toBe(true);
    expect(tasteIsEmpty({ city: null, interests: ["make"], timing: null })).toBe(false);
  });
});
