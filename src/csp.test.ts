import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Content Security Policy in vercel.json allows inline scripts by hash only. Sessions live in
 * localStorage, so this policy is what stands between an injected script and a session token.
 * Change an inline script in index.html and this fails until its new hash is in the policy.
 */
const root = path.resolve(__dirname, "..");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("Content Security Policy", () => {
  it("is set for every path", () => {
    expect(vercel.headers.some((h) => h.source === "/(.*)" && h.headers.some((x) => x.key === "Content-Security-Policy"))).toBe(true);
  });

  it("has a hash for every inline script in index.html (JSON-LD data blocks aside)", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/application\/ld\+json/.test(m[1]));
    expect(inline.length).toBeGreaterThan(0);
    for (const m of inline) {
      const hash = createHash("sha256").update(m[2]).digest("base64");
      expect(directive("script-src")).toContain(`'sha256-${hash}'`);
    }
  });

  it("never allows unsafe-inline or unsafe-eval scripts, plugins, framing or other origins' forms", () => {
    expect(directive("script-src")).not.toMatch(/unsafe-inline|unsafe-eval|\*(?!\.)/);
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
  });
});
