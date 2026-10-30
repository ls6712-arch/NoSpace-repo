// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildIcs, downloadIcs, icsFileName } from "./calendarFile";

const start = Date.UTC(2026, 9, 31, 19, 0, 0);

describe("calendar file", () => {
  it("is one event at the plan's time with an alarm an hour before", () => {
    const ics = buildIcs({ title: "Bouldering night", startsAt: start, where: "Williamsburg, New York" }, Date.UTC(2026, 9, 30));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261031T190000Z");
    expect(ics).toContain("DTEND:20261031T200000Z");
    expect(ics).toContain("SUMMARY:Bouldering night");
    expect(ics).toContain("LOCATION:Williamsburg\\, New York");
    expect(ics).toContain("BEGIN:VALARM\r\nACTION:DISPLAY");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it("escapes text and folds long lines", () => {
    const ics = buildIcs({ title: "A; B, C", startsAt: start, note: `x${"y".repeat(200)}\nz` });
    expect(ics).toContain("SUMMARY:A\; B\\, C");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(ics).toContain("\\nz");
  });
  it("names the file from the title", () => {
    expect(icsFileName("Bouldering night!")).toBe("bouldering-night.ics");
    expect(icsFileName("!!!")).toBe("plan.ics");
  });
  it("downloads it", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    downloadIcs({ title: "Bouldering night", startsAt: start });
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
