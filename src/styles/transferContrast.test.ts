import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Transfer palette is not final, so this reads the live values from theme.css
 * and fails if a change to them drops a pairing below 4.5:1 (onboarding brief, section 8).
 */
const css = fs.readFileSync(path.resolve(__dirname, "theme.css"), "utf8");
const block = css.slice(css.indexOf(".soosh-transfer {"));
const token = (name: string) => {
  const hex = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block)?.[1];
  if (!hex) throw new Error(`--${name} not found in .soosh-transfer`);
  return hex;
};

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAIRS: [string, string, string][] = [
  ["navy", "platform", "text on question screens"],
  ["muted", "platform", "secondary text on question screens"],
  ["muted", "white", "secondary text on cards"],
  ["navy", "signal", "button label"],
  ["white", "cobalt", "welcome and selected chips"],
  ["white", "navy", "text on dark screens"],
  ["line", "navy", "secondary text on dark screens"],
  ["line", "cobalt", "secondary text on the welcome"],
  ["signal", "navy", "Stubby on dark screens"],
];

describe("Transfer palette contrast", () => {
  it.each(PAIRS)("%s on %s is at least 4.5:1 (%s)", (fg, bg) => {
    expect(ratio(token(`transfer-${fg}`), token(`transfer-${bg}`))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Transfer button on dark screens", () => {
  it("takes a white border and a cobalt drop from the tokens", () => {
    const rule = /\.transfer-button\[data-on-dark="true"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("border-color: var(--transfer-white)");
    expect(rule).toContain("var(--transfer-cobalt)");
  });
});
