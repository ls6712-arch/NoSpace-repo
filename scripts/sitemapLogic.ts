// The sitemap, as pure functions. Only real paths that return their own HTML are listed: this app's own
// screens use hash URLs ("/#/corners"), which a search engine cannot index as separate pages, so they are
// not here; the static pages under public/ (guides, planners) and the home page are.

export const SITE = "https://www.onsoosh.com";
/** The sitemap protocol's limit for one file. */
export const SITEMAP_LIMIT = 50_000;

/** True unless the page asks not to be indexed. */
export const isIndexable = (html: string): boolean => !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html);

/**
 * "hobbies/free/index.html" (relative to public/) to "/hobbies/free/"; the root "index.html" to "/".
 * Anything that is not an index.html is not a page.
 */
export function pagePath(file: string): string | null {
  const f = file.replace(/\\/g, "/").replace(/^\/+/, "");
  if (f === "index.html") return "/";
  if (!f.endsWith("/index.html")) return null;
  return `/${f.slice(0, -"index.html".length)}`;
}

/** The URLs to list: the home page first, then the rest A to Z. Throws past the protocol's limit. */
export function sitemapUrls(pages: { file: string; html: string }[]): string[] {
  const paths = new Set<string>(["/"]);
  for (const p of pages) {
    const path = pagePath(p.file);
    if (path && isIndexable(p.html)) paths.add(path);
  }
  const urls = [...paths].sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b))).map((p) => `${SITE}${p}`);
  if (urls.length > SITEMAP_LIMIT) throw new Error(`${urls.length} URLs is over the ${SITEMAP_LIMIT} a sitemap file may hold; split it into an index.`);
  return urls;
}

/** `lastmod` is the build date (YYYY-MM-DD). No changefreq or priority. */
export function sitemapXml(urls: string[], lastmod: string): string {
  const esc = (u: string) => u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
