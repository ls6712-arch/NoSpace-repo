import { describe, expect, it } from "vitest";
import { analyticsPath, shouldLoadAnalytics } from "./googleAnalytics";

describe("analyticsPath", () => {
  it("keeps only the first part of the route", () => {
    expect(analyticsPath("#/moment/123")).toBe("/moment");
    expect(analyticsPath("#/u/someone?tab=1")).toBe("/u");
    expect(analyticsPath("#/discover")).toBe("/discover");
  });
  it("never passes through tokens or codes", () => {
    expect(analyticsPath("#access_token=abc&type=recovery")).toBe("/");
    expect(analyticsPath("#/i/SECRETCODE")).toBe("/i");
    expect(analyticsPath("")).toBe("/");
  });
});

describe("shouldLoadAnalytics", () => {
  it("loads only with a valid id on the live site", () => {
    expect(shouldLoadAnalytics("G-ABC1234567", "www.onsoosh.com", false)).toBe(true);
    expect(shouldLoadAnalytics(undefined, "www.onsoosh.com", false)).toBe(false);
    expect(shouldLoadAnalytics("UA-1234", "www.onsoosh.com", false)).toBe(false);
  });
  it("stays off on staging, previews and localhost", () => {
    expect(shouldLoadAnalytics("G-ABC1234567", "www.trynospace.com", false)).toBe(false);
    expect(shouldLoadAnalytics("G-ABC1234567", "no-space-repo.vercel.app", false)).toBe(false);
    expect(shouldLoadAnalytics("G-ABC1234567", "localhost", false)).toBe(false);
  });
  it("respects Do Not Track and Global Privacy Control", () => {
    expect(shouldLoadAnalytics("G-ABC1234567", "www.onsoosh.com", true)).toBe(false);
  });
});
