import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "./app/landing/copy";

// index.html carries a plain-HTML copy of the landing page for crawlers that
// don't run JavaScript (see the comment inside #root). These checks keep it
// in step with the real landing copy and keep the structured data valid.
const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");

describe("index.html crawler copy", () => {
  it("has every FAQ question and answer from the landing page", () => {
    for (const { q, a } of LANDING_COPY.faq) {
      expect(html).toContain(`<dt>${q}</dt>`);
      expect(html).toContain(`<dd>${a}</dd>`);
    }
  });

  it("has every how-it-works step", () => {
    for (const step of LANDING_COPY.steps) {
      expect(html).toContain(`<strong>${step.title}.</strong> ${step.line}`);
    }
  });

  it("has valid JSON-LD with the same FAQ", () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]);
    const faq = data["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    const pairs = faq.mainEntity.map((e: { name: string; acceptedAnswer: { text: string } }) => [e.name, e.acceptedAnswer.text]);
    expect(pairs).toEqual(LANDING_COPY.faq.map(({ q, a }) => [q, a]));
    expect(html).not.toContain("Where are local suggestions available?");
  });

  it("keeps the crawler copy inside #root, so React replaces it", () => {
    const root = html.slice(html.indexOf('<div id="root">'));
    expect(root.indexOf('<main class="crawler-copy"')).toBeGreaterThan(0);
    expect(root.indexOf("</main>")).toBeLessThan(root.indexOf("</div>\n    <script"));
  });

  it("uses the same positioning in metadata without claiming free admission, pass coverage or automatic bookings",()=>{
    const title=LANDING_COPY.metaTitle.replace(/&/g, "&amp;");
    expect(html).toContain(`<title>${title}</title>`);
    for (const name of ["og:title", "twitter:title"]) {
      expect(html).toContain(`${name}" content="${title}"`);
    }
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../public/site.webmanifest"), "utf8"));
    expect(manifest.description).toBe(LANDING_COPY.heroSub);
    for(const name of ["description","og:description","twitter:description"]){
      expect(html).toMatch(new RegExp(`(?:name|property)="${name}" content="${LANDING_COPY.metaDescription}"`));
    }
    expect(html).toContain(LANDING_COPY.pursuitLine);
    expect(html).toContain(LANDING_COPY.examplesLine);
    expect(html).not.toMatch(/New York|Local suggestions start|display:none|clip:rect/);
    expect(html).not.toMatch(/Free tonight|gym or museum membership|"offers"|You get a Stub each time/);
    expect(html).toContain("Stubby, Soosh’s ticket-shaped activity helper.");
  });
});
