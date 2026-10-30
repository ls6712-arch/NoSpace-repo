import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * posts.starts_at and posts.location_name can be read by anyone until
 * docs/tickets/posts-column-privacy.md is done. So the Log flow may write them
 * only the way it already does (the Activity fields), and must not start
 * writing an exact place or time for an ordinary Moment, nor the owner-only
 * profile fields (set_post_private, place_name, occurred_at).
 */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");
const log = read("./Log.tsx");
/** Code only: a comment may name the columns. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Log does not write exact place or time for Moments", () => {
  it("never touches the columns or the owner-only profile fields directly", () => {
    expect(code(log)).not.toMatch(/\blocation_name\b|\bstarts_at\b|set_post_private|setPostPrivate|\bplace_name\b|\boccurred_at\b/);
  });

  it("passes a start time only for an Activity, and one place field", () => {
    expect(log.match(/startsAt: isActivity && startsAt \?/g)).toHaveLength(1);
    expect(log.match(/startsAt:/g)).toHaveLength(1);
    expect(log.match(/locationName: locationName\.trim\(\) \? locationName\.trim\(\) : undefined/g)).toHaveLength(1);
  });

  it("keeps the pointer to the ticket next to that line", () => {
    expect(log).toContain("docs/tickets/posts-column-privacy.md");
  });

  it("the Moment save path only writes the profile fields through the owner function, which Log never calls", () => {
    const content = read("../context/ContentContext.tsx");
    expect(code(content)).not.toMatch(/set_post_private|place_name|occurred_at/);
  });
});

describe("Share now in Log", () => {
  it("is a switch that starts off, with its helper text, and is passed to the save", () => {
    expect(log).toMatch(/useState\(false\);\s*\n/);
    expect(log).toMatch(/const \[shareNow, setShareNow\] = useState\(false\)/);
    expect(log).toContain(">Share now</Label>");
    expect(log).toContain("Shows this Moment to others right away.");
    expect(log).toContain('shareNow: circle !== "private" && shareNow,');
  });
});
