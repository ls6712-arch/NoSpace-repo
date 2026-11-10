import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allUserFacingStrings } from "../../../../scripts/userFacingStrings";

/**
 * One Moment, everywhere (brief v2, Nov 10, 2026). Every surface draws a
 * Moment with the parts in this folder, and a Moment has no action button.
 * This fails when either stops being true:
 *
 *  1. a file outside `components/moment/` uses `useReactionState` (that is a
 *     second reaction row being built somewhere);
 *  2. one of the removed phrases is back in `src/app`.
 */
const ROOT = path.resolve(__dirname, "../../../..");
const HERE = "src/app/components/moment/";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");

describe("only one Moment", () => {
  it("uses useReactionState only inside components/moment", () => {
    const offenders = sourceFiles(path.join(ROOT, "src"))
      .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
      // The hook's own file, and this folder.
      .filter((rel) => rel !== "src/app/lib/reactionState.ts" && !rel.startsWith(HERE))
      .filter((rel) => /\buseReactionState\b/.test(withoutComments(fs.readFileSync(path.join(ROOT, rel), "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("draws a Moment from this folder only: the four old components are gone", () => {
    for (const gone of ["components/MomentCard.tsx", "components/MomentDetail.tsx", "components/home/FeedCard.tsx", "components/start/DoThisLink.tsx"]) {
      expect(fs.existsSync(path.join(ROOT, "src/app", gone)), gone).toBe(false);
    }
  });

  const strings = allUserFacingStrings(ROOT).filter((s) => s.file.startsWith("src/app/"));
  const show = (hits: typeof strings) => hits.map((h) => `${h.file}:${h.line}  ${h.text.slice(0, 90)}`);

  // Each removed phrase, as it would appear in a string or in JSX text.
  const REMOVED: [name: string, test: (text: string) => boolean][] = [
    // "Do this with people" is the Corner page's way into Make it a Pursuit, not a button on a Moment.
    ["Do this", (t) => /\bDo this\b(?! with people)/.test(t)],
    ["Count me in", (t) => /\bCount me in\b/i.test(t)],
    // "Try Soosh" on the landing page is the app's name, not a Corner.
    ["Try {corner}", (t) => /^Try( \$\{(?!APP_NAME)|$)/.test(t)],
    ["See {corner}", (t) => /^See( \$\{|$)/.test(t)],
    ["Make your version", (t) => /\bMake your version\b/i.test(t)],
    ["Start a Pursuit inspired by this", (t) => /inspired by this/i.test(t)],
    ["Start a Pursuit with {name}?", (t) => /^Start a Pursuit with( |$)(?!friends)/.test(t)],
    ["Ask {name} to make it together?", (t) => /to make it together\?/i.test(t)],
    ["Quick react", (t) => /\bquick react/i.test(t)],
    ["Hobby (the label)", (t) => t === "Hobby"],
  ];

  /**
   * The one exception, for the founder to settle: the public landing page still
   * advertises the wall strip ("Tap Make your version and start your own.").
   * Its replacement is new marketing copy, which needs approval, so the landing
   * strings stay as they are until then. Nothing in the app itself is exempt.
   */
  const exempt = (s: { file: string; text: string }) => s.file.startsWith("src/app/landing/") && /Make your version/.test(s.text);

  it.each(REMOVED)("has no “%s” anywhere in src/app", (_name, test) => {
    expect(show(strings.filter((s) => test(s.text) && !exempt(s)))).toEqual([]);
  });

  it("never says You’re in on a Moment (a Pursuit session keeps its own)", () => {
    expect(show(strings.filter((s) => s.file.startsWith(HERE) && /You[’']re in\b/.test(s.text)))).toEqual([]);
  });

  it("recognizes the removed phrases", () => {
    const hit = (name: string, text: string) => REMOVED.find(([n]) => n === name)![1](text);
    expect(hit("Do this", "Do this")).toBe(true);
    expect(hit("Do this", "Do this with people")).toBe(false);
    expect(hit("Try {corner}", "Try ${name}")).toBe(true);
    expect(hit("Try {corner}", "Try")).toBe(true);
    expect(hit("Try {corner}", "Try again")).toBe(false);
    expect(hit("Try {corner}", "Try ${APP_NAME}")).toBe(false);
    expect(hit("See {corner}", "See ${cornerName}")).toBe(true);
    expect(hit("See {corner}", "See all")).toBe(false);
    expect(hit("Start a Pursuit with {name}?", "Start a Pursuit with")).toBe(true);
    expect(hit("Start a Pursuit with {name}?", "Start a Pursuit")).toBe(false);
  });
});
