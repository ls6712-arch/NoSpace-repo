import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../../supabase/templates");
const REAL = new Set(["ConfirmationURL", "Token", "TokenHash", "SiteURL", "Email", "NewEmail", "RedirectTo", "Data"]);
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".html"));

describe("supabase auth email templates", () => {
  it("has all five", () => {
    expect(files.sort()).toEqual(["confirmation.html", "email_change.html", "invite.html", "magic_link.html", "recovery.html"]);
  });
  for (const f of files) {
    const html = fs.readFileSync(path.join(DIR, f), "utf8");
    it(`${f}: only real Supabase variables, no placeholders`, () => {
      for (const m of html.matchAll(/\{\{\s*\.(\w+)\s*\}\}/g)) expect(REAL.has(m[1])).toBe(true);
      expect(html.replace(/\{\{\s*\.\w+\s*\}\}/g, "")).not.toMatch(/\{\{|\}\}|\[PLACEHOLDER|example\.com|TODO/);
    });
    it(`${f}: one button, no dashes, no exclamation marks`, () => {
      expect((html.match(/display:inline-block/g) ?? []).length).toBe(1);
      const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
      expect(text).not.toMatch(/[—–]|\s-\s|!/);
      expect(html).toContain("{{ .ConfirmationURL }}");
    });
  }
});
