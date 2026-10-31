import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for the one-skin cleanup: the retired tokens, Tailwind's default
 * breakpoints and bare 100vh must not come back, and the 44px tap-target rule
 * must cover phone-width windows as well as touch screens.
 */
const SRC = path.resolve(__dirname, "..");
const theme = fs.readFileSync(path.resolve(__dirname, "theme.css"), "utf8");

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = sources(SRC).map((f) => ({ f: path.relative(SRC, f), text: fs.readFileSync(f, "utf8") }));
const offenders = (re: RegExp) => files.filter(({ text }) => re.test(text)).map(({ f }) => f);

describe("one-skin cleanup", () => {
  it("has one accent-text token and no violet or void tokens", () => {
    expect(offenders(/--coral-deep|--coral-text|--violet|--void|--ink-on-violet|--plum-night/)).toEqual([]);
  });

  it("uses only the tab, desk and wide breakpoints", () => {
    expect(offenders(/(^|[^A-Za-z0-9_-])(max-)?(sm|md|lg|xl|2xl):[a-z[!-]/)).toEqual([]);
    expect(theme).toMatch(/--breakpoint-\*:\s*initial/);
  });

  it("never uses a bare 100vh without a dvh line after it", () => {
    for (const { f, text } of files) {
      const lines = text.split("\n");
      lines.forEach((l, i) => {
        if (/^\s*(min-|max-)?height:.*\b100vh\b/.test(l)) expect(`${f}:${i + 1} ${lines[i + 1] ?? ""}`).toMatch(/100dvh/);
      });
    }
  });

  it("gives every tappable element a 44px hit area on phone-width windows too", () => {
    const rule = /@media \(pointer: coarse\), \(max-width: 743px\) \{[\s\S]*?width: max\(100%, 44px\);[\s\S]*?height: max\(100%, 44px\);/;
    expect(theme).toMatch(rule);
  });
});
