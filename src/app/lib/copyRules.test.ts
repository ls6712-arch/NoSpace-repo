import path from "node:path";
import { describe, expect, it } from "vitest";
import { allUserFacingStrings, extractStrings } from "../../../scripts/userFacingStrings";

/**
 * Keeps docs/style-guide.md true after this pass. Each rule scans every
 * string a person can read (see scripts/userFacingStrings.ts). When one
 * fails, fix the copy; only extend an allow-list below for a real exception.
 */
const strings = allUserFacingStrings(path.resolve(__dirname, "../../.."));
const NOUNS =
  "Moments?|Pursuits?|Corners?|Spaces?|followers?|people|likes?|thoughts?|photos?|members?|tags?|hours?|days?|minutes?|items?";
// A count is a number-ish expression; "No ${cornerName} Moments" is a name.
const COUNTISH = "[^}]*(count|length|total|num|\\bn\\b|size|sessions)[^}]*";
const HAND_BUILT = new RegExp(
  `(\\$\\{${COUNTISH}\\}|\\{${COUNTISH}\\})\\s+(${NOUNS})\\b|===? 1 \\? "" : "s"|!==? 1 \\? "s"`,
  "i",
);
const isHandBuiltPlural = (text: string) => HAND_BUILT.test(text);
const show = (hits: { file: string; line: number; text: string }[]) =>
  hits.map((h) => `${h.file}:${h.line}  ${h.text.slice(0, 90)}`);

describe("copy rules", () => {
  it("finds strings to check", () => {
    expect(strings.length).toBeGreaterThan(1000);
  });

  // G3
  it("has no em or en dashes in user-facing strings", () => {
    expect(show(strings.filter((s) => /[—–]/.test(s.text)))).toEqual([]);
  });

  // G4. "Nature journaling" is a Corner name, so it is allowed.
  it("has no banned phrases", () => {
    const banned = /\b(journal(ing|s)?|diary|diaries|reflect(s|ion|ions)?|habits?|streaks?)\b|not ranked|non-metric|never scored/i;
    // Allowed: the Nature journaling Corner, and the one Privacy page line that
    // must stay until reflection data is deleted (TODO(privacy) in
    // PrivacyPolicy.tsx; remove this entry with that line).
    const allowed = /nature[- ]journaling|private reflections you wrote before that feature was/i;
    // Import paths and storage keys ("../lib/journal", "sushii.journal.v1") are code, not copy.
    const isCode = (t: string) => /^(\.{1,2}\/|[\w-]+(\.[\w-]+)+$)/.test(t);
    const hits = strings.filter((s) => banned.test(s.text) && !allowed.test(s.text) && !isCode(s.text));
    expect(show(hits)).toEqual([]);
  });

  // The two named documents keep their capitals (style guide, "Proper names").
  it("writes Terms and Privacy Policy as proper names", () => {
    const wrong = /\b[Pp]rivacy policy\b|\b[Tt]erms of [sS]ervice\b/;
    const hits = strings.filter((s) => s.file.startsWith("src/") && wrong.test(s.text));
    expect(show(hits)).toEqual([]);
  });

  // G6: counts go through plural() so 1 and 2 are always right.
  it("builds no plurals by hand", () => {
    const hits = strings.filter(
      (s) => s.file.startsWith("src/") && isHandBuiltPlural(s.text) && !s.text.includes("plural("),
    );
    expect(show(hits)).toEqual([]);
  });

  it("recognizes a hand-built plural", () => {
    expect(isHandBuiltPlural("${followerCount} followers")).toBe(true);
    expect(isHandBuiltPlural("{items.length} Moments")).toBe(true);
    expect(isHandBuiltPlural('{n} Pursuit{n === 1 ? "" : "s"}')).toBe(true);
    // A name followed by a noun is not a count.
    expect(isHandBuiltPlural("No ${corner.name} Moments yet.")).toBe(false);
  });
});

describe("extractStrings", () => {
  it("reads strings and JSX text but not comments", () => {
    const src = '// "hidden"\nconst a = "shown";\n/* "also hidden" */\n<p>Visible text</p>';
    expect(extractStrings("x.tsx", src).map((s) => s.text)).toEqual(["shown", "Visible text"]);
  });
});
