// Writes sitemap.xml into the build output (default dist/) from the static pages under public/ and the
// home page, so a new page appears the next time the site is built. Run after `vite build`.
//   node scripts/build-sitemap.ts [outDir]
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sitemapUrls, sitemapXml } from "./sitemapLogic.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const out = path.resolve(ROOT, process.argv[2] ?? "dist");

function walk(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    return statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), rel) : [rel];
  });
}

const pages = walk(PUBLIC).filter((f) => f.endsWith("index.html")).map((file) => ({ file, html: readFileSync(path.join(PUBLIC, file), "utf8") }));
// The home page is the app's own index.html, which Vite writes to the output root.
pages.push({ file: "index.html", html: readFileSync(path.join(ROOT, "index.html"), "utf8") });
const urls = sitemapUrls(pages);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "sitemap.xml"), sitemapXml(urls, new Date().toISOString().slice(0, 10)));
console.log(`build-sitemap: ${urls.length} URLs written to ${path.relative(ROOT, path.join(out, "sitemap.xml"))}`);
