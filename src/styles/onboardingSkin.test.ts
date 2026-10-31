import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Onboarding and login use the app tokens, so this checks the pairings they
 * rely on in both themes (WCAG AA), and that no Transfer value is left.
 */
const SRC = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.resolve(__dirname, "theme.css"), "utf8");
const block = (sel: string) => {
  const start = css.search(new RegExp(`^${sel.replace(".", "\\.")} \\{`, "m"));
  return css.slice(start, css.indexOf("\n}", start));
};
const root = block(":root");
const dark = root + block(".dark");
/** The last definition of a token in the block, following var() references. */
const hex = (b: string, name: string): string => {
  const all = [...b.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, "g"))];
  if (!all.length) throw new Error(`--${name} not found`);
  const v = all[all.length - 1][1].trim();
  const ref = /^var\(--([a-z-]+)\)$/.exec(v);
  if (ref) return hex(b, ref[1]);
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`--${name} is ${v}`);
  return v;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (fg: string, bg: string, p: number) =>
  "#" + rgb(fg).map((c, i) => Math.round(c * p + rgb(bg)[i] * (1 - p)).toString(16).padStart(2, "0")).join("");

describe("onboarding contrast, both themes", () => {
  for (const [name, b] of [["light", root], ["dark", dark]] as const) {
    it(`${name}: ink on the coral Stubby is at least 4.5:1`, () => {
      expect(ratio(hex(b, "ink"), hex(b, "accent"))).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: a selected chip (page colour on the text colour) is at least 4.5:1`, () => {
      expect(ratio(hex(b, "background"), hex(b, "foreground"))).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: an empty step bar is at least 3:1 on the page`, () => {
      expect(ratio(mix(hex(b, "foreground"), hex(b, "background"), 0.5), hex(b, "background"))).toBeGreaterThanOrEqual(3);
    });
    it(`${name}: a filled step bar is at least 3:1 on an empty one`, () => {
      expect(ratio(hex(b, "foreground"), mix(hex(b, "foreground"), hex(b, "background"), 0.5))).toBeGreaterThanOrEqual(3);
    });
  }

  it("dark: the Stubby tab (the text colour) keeps the ink stamp readable", () => {
    expect(ratio(hex(dark, "ink"), hex(dark, "foreground"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("one skin on the onboarding screens", () => {
  it("has every --stubby-* value as a var()", () => {
    const tokens = [...css.matchAll(/--stubby-[a-z-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(tokens.length).toBeGreaterThanOrEqual(8);
    for (const t of tokens) expect(t).toMatch(/^var\(--[a-z-]+\)$/);
  });

  it("keeps no Transfer scope, token, font or hex", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) files.push(p);
      }
    };
    walk(SRC);
    const bad = files.filter((f) => /soosh-transfer|--transfer-|TransferButton|Archivo|#FFD23F|#1F3FD1|#0E1A4F|#EEF0F6|#C9CFE3/i.test(fs.readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
