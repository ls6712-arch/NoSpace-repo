import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STAGING_HOSTNAMES } from "../src/app/config";
import { SITE, SITEMAP_LIMIT, isIndexable, pagePath, sitemapUrls, sitemapXml } from "./sitemapLogic";

const page = (file: string, html = "<html></html>") => ({ file, html });

describe("sitemap", () => {
  it("turns an index.html into the real path that serves it", () => {
    expect(pagePath("index.html")).toBe("/");
    expect(pagePath("hobbies/free/index.html")).toBe("/hobbies/free/");
    expect(pagePath("hobbies/free.html")).toBeNull();
    expect(pagePath("landing/hero.webp")).toBeNull();
  });

  it("lists the home page first, then pages A to Z, once each, and never a page that says noindex", () => {
    const urls = sitemapUrls([
      page("planner/index.html"), page("hobbies/free/index.html"), page("hobbies/index.html"), page("hobbies/index.html"),
      page("social-life/hidden/index.html", '<meta name="robots" content="noindex, follow">'), page("index.html"),
    ]);
    expect(urls).toEqual([`${SITE}/`, `${SITE}/hobbies/`, `${SITE}/hobbies/free/`, `${SITE}/planner/`]);
    expect(isIndexable('<meta name="robots" content="noindex">')).toBe(false);
    expect(isIndexable('<meta name="robots" content="index,follow">')).toBe(true);
  });

  it("writes lastmod from the build date and no changefreq or priority", () => {
    const xml = sitemapXml([`${SITE}/`, `${SITE}/a&b/`], "2026-11-07");
    expect(xml).toContain("<url><loc>https://www.onsoosh.com/</loc><lastmod>2026-11-07</lastmod></url>");
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toMatch(/changefreq|priority/);
  });

  it("refuses to write more URLs than one file may hold", () => {
    const many = Array.from({ length: SITEMAP_LIMIT + 1 }, (_, i) => page(`p${i}/index.html`));
    expect(() => sitemapUrls(many)).toThrow(/50000/);
  });
});

describe("the real pages", () => {
  const walk = (dir: string, base = ""): string[] => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n), base ? `${base}/${n}` : n) : [base ? `${base}/${n}` : n]));
  const pages = walk("public").filter((f) => f.endsWith("index.html")).map((file) => ({ file, html: readFileSync(path.join("public", file), "utf8") }));
  pages.push({ file: "index.html", html: readFileSync("index.html", "utf8") });
  const urls = sitemapUrls(pages);

  it("are all on the live site, are real paths, and name no city", () => {
    expect(urls.length).toBeGreaterThanOrEqual(28);
    for (const u of urls) {
      expect(u.startsWith(`${SITE}/`), u).toBe(true);
      expect(u, u).not.toMatch(/#|\?/);
      expect(u, u).not.toMatch(/nyc|new-york|brooklyn|manhattan|staging|preview|vercel\.app/i);
      for (const host of STAGING_HOSTNAMES) expect(u).not.toContain(host);
    }
  });
});

describe("robots", () => {
  it("point to the sitemap, and the staging host gets a robots.txt that blocks everything", () => {
    expect(readFileSync("public/robots.txt", "utf8")).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(readFileSync("public/robots-staging.txt", "utf8")).toMatch(/User-agent: \*\s+Disallow: \/\s*$/);
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { rewrites?: { source: string; destination: string; has?: { type: string; value: string }[] }[] };
    const hosts = (vercel.rewrites ?? []).filter((r) => r.source === "/robots.txt" && r.destination === "/robots-staging.txt").flatMap((r) => (r.has ?? []).filter((h) => h.type === "host").map((h) => h.value));
    expect(hosts.sort()).toEqual([...STAGING_HOSTNAMES].sort());
  });
});
