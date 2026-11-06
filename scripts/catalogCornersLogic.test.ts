import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { csvRows, INTERNAL_CATEGORY_TO_SPACE, keptEntries, mergeCatalog, parseCsv, renderCatalogFile, type CatalogEntry } from "./catalogCornersLogic";
import { CATALOG_ALIAS_ADDITIONS, CATALOG_CORNERS, CATALOG_EXISTING_META } from "../src/app/data/catalogCorners";
import { hobbies, canonicalCorner } from "../src/app/data/hobbies";
import { catalogCornerByName } from "../src/app/lib/catalogLookup";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const csvText = fs.readFileSync(path.join(root, "data/corners_catalog.csv"), "utf8");

const entry = (o: Partial<CatalogEntry> & { slug: string }): CatalogEntry => ({
  name: o.slug, spaceSlug: "crafts-making", aliases: [], nycFit: "city", ...o,
});

describe("CSV generation", () => {
  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });

  it("keeps exactly the 383 keep rows of the real file", () => {
    const rows = csvRows(csvText);
    expect(rows).toHaveLength(443);
    expect(keptEntries(rows)).toHaveLength(383);
  });

  it("maps every internal category to a real Space", () => {
    const slugs = new Set(hobbies.map((h) => h.slug));
    for (const v of Object.values(INTERNAL_CATEGORY_TO_SPACE)) expect(slugs.has(v)).toBe(true);
    expect(Object.keys(INTERNAL_CATEGORY_TO_SPACE)).toHaveLength(15);
  });

  it("rejects an unknown category, a bad nyc_fit and a duplicate slug", () => {
    const base = { name: "X", slug: "x", internal_category: "Music", nyc_fit: "city", season: "", status: "keep", aliases: "", note: "" };
    expect(() => keptEntries([{ ...base, internal_category: "Nope" }])).toThrow(/internal_category/);
    expect(() => keptEntries([{ ...base, nyc_fit: "mars" }])).toThrow(/nyc_fit/);
    expect(() => keptEntries([base, base])).toThrow(/duplicate/);
  });

  it("splits aliases on semicolons", () => {
    const [p] = keptEntries(csvRows(csvText).filter((r) => r.slug === "pottery"));
    expect(p.aliases).toEqual(["Ceramics", "wheel throwing", "hand building", "clay"]);
  });

  it("leaves review and drop rows out of the generated file", () => {
    const keptSlugs = new Set(keptEntries(csvRows(csvText)).map((e) => e.slug));
    for (const r of csvRows(csvText).filter((r) => r.status !== "keep")) expect(keptSlugs.has(r.slug)).toBe(false);
    for (const c of CATALOG_CORNERS) expect(["review", "drop"]).not.toContain(csvRows(csvText).find((r) => r.slug === c.slug)?.status);
  });

  it("the committed catalogCorners.ts is what the script would write", () => {
    // Same inputs as build-catalog-corners.ts; run `npx tsx scripts/build-catalog-corners.ts` if this fails.
    const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data/existing_corners_snapshot.json"), "utf8"));
    const approvals = JSON.parse(fs.readFileSync(path.join(root, "data/catalog_merge_overrides.json"), "utf8"));
    const existing = [
      ...hobbies.flatMap((h) => h.subItems.map((s) => ({ spaceSlug: h.slug, slug: s.slug, name: s.label }))),
      ...snapshot.corners,
    ];
    const uniq = [...new Map(existing.map((c: { spaceSlug: string; slug: string }) => [`${c.spaceSlug}/${c.slug}`, c])).values()];
    const result = mergeCatalog(keptEntries(csvRows(csvText)), uniq as never, {
      overrides: approvals.overrides, keepSeparate: approvals.keepSeparate, canonical: canonicalCorner,
    });
    expect(fs.readFileSync(path.join(root, "src/app/data/catalogCorners.ts"), "utf8")).toBe(renderCatalogFile(result));
  });
});

describe("merging with existing Corners", () => {
  const existing = [
    { spaceSlug: "crafts-making", slug: "pottery", name: "Pottery" },
    { spaceSlug: "crafts-making", slug: "crochet", name: "Crochet" },
    { spaceSlug: "sports-fitness", slug: "skating", name: "Roller and ice skating" },
    { spaceSlug: "travel-adventure", slug: "camping", name: "Camping" },
    { spaceSlug: "music", slug: "guitar", name: "Guitar" },
  ];

  it("same slug in the same Space: the existing Corner wins and gains the aliases", () => {
    const r = mergeCatalog([entry({ slug: "pottery", name: "Pottery!", aliases: ["clay"] })], existing);
    expect(r.fresh).toHaveLength(0);
    expect(r.merged[0]).toMatchObject({ rule: "same-slug", existing: { name: "Pottery" } });
    expect(r.aliasAdditions["crafts-making/pottery"]).toEqual(["Pottery!", "clay"]);
  });

  it("a catalog name or alias equal to an existing name merges, case-insensitively", () => {
    const r = mergeCatalog([entry({ slug: "ceramics-studio", name: "Ceramics studio", aliases: ["POTTERY"] })], existing);
    expect(r.merged[0].rule).toBe("name-or-alias");
  });

  it("a fuzzy match only suggests: the entry is still created", () => {
    const r = mergeCatalog([entry({ slug: "ice-hockey", name: "Ice hockey", spaceSlug: "sports-fitness" })], existing);
    expect(r.merged).toHaveLength(0);
    expect(r.suggested[0].existing.slug).toBe("skating");
    expect(r.fresh.map((e) => e.slug)).toEqual(["ice-hockey"]);
  });

  it("the same hobby in another Space is listed and held out, never merged", () => {
    const r = mergeCatalog([entry({ slug: "camping", name: "Camping", spaceSlug: "nature-outdoors" })], existing);
    expect(r.crossSpace[0].existing.spaceSlug).toBe("travel-adventure");
    expect(r.crossSpace[0].rule).toBe("same-slug");
    expect(r.merged).toHaveLength(0);
    expect(r.fresh).toHaveLength(0);
  });

  it("an approved override merges; keepSeparate keeps an umbrella apart from a narrower Corner", () => {
    const o = mergeCatalog([entry({ slug: "crocheting", name: "Crocheting" })], existing, { overrides: { crocheting: "crafts-making/crochet" } });
    expect(o.merged[0]).toMatchObject({ rule: "override", existing: { slug: "crochet" } });
    const k = mergeCatalog([entry({ slug: "playing-an-instrument", spaceSlug: "music", aliases: ["guitar"] })], existing, { keepSeparate: ["playing-an-instrument"] });
    expect(k.merged).toHaveLength(0);
    expect(k.fresh).toHaveLength(1);
  });

  it("a match on a Corner that was merged away is a follow-on decision: nothing is applied", () => {
    const pool = [{ spaceSlug: "a", slug: "old", name: "Old" }, { spaceSlug: "a", slug: "kept", name: "Kept" }];
    const canonical = (s: string, sl: string) => (sl === "old" ? { spaceSlug: s, slug: "kept" } : { spaceSlug: s, slug: sl });
    const r = mergeCatalog([entry({ slug: "old", name: "Old", spaceSlug: "a" })], pool, { canonical });
    expect(r.followOn[0]).toMatchObject({ existing: { slug: "kept" }, via: { slug: "old" } });
    expect(r.merged).toHaveLength(0);
    expect(r.fresh).toHaveLength(0);
    expect(r.aliasAdditions).toEqual({});
    expect(r.existingMeta).toEqual({});
  });

  it("a held-out cross-Space row gives its aliases, nyc_fit and season to the existing Corner", () => {
    const r = mergeCatalog([entry({ slug: "camping", name: "Camping", spaceSlug: "nature-outdoors", aliases: ["tent camping"], nycFit: "day_trip", season: "warm" })], existing);
    expect(r.fresh).toHaveLength(0);
    expect(r.aliasAdditions["travel-adventure/camping"]).toEqual(["tent camping"]);
    expect(r.existingMeta["travel-adventure/camping"]).toEqual({ nycFit: "day_trip", season: "warm" });
  });
});

describe("the generated catalog against the app's Corners", () => {
  it("never repeats a slug inside a Space, and never repeats a curated Corner", () => {
    const seen = new Set<string>();
    for (const c of CATALOG_CORNERS) {
      const k = `${c.spaceSlug}/${c.slug}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(hobbies.find((h) => h.slug === c.spaceSlug)?.subItems.some((s) => s.slug === c.slug)).toBe(false);
    }
  });

  it("alias additions and metadata point at Corners that exist (built in, or a table row in the snapshot)", () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data/existing_corners_snapshot.json"), "utf8"));
    const known = new Set([
      ...hobbies.flatMap((h) => h.subItems.map((s) => `${h.slug}/${s.slug}`)),
      ...snapshot.corners.map((c: { spaceSlug: string; slug: string }) => `${c.spaceSlug}/${c.slug}`),
    ]);
    for (const key of [...Object.keys(CATALOG_ALIAS_ADDITIONS), ...Object.keys(CATALOG_EXISTING_META)]) expect(known.has(key), key).toBe(true);
  });

  it("the six cross-Space rows reach the existing Corner, not a second one", () => {
    for (const key of ["nature-outdoors/camping", "health-wellness/pilates", "travel-adventure/skiing", "food-cooking/storytelling", "nature-outdoors/surfing", "travel-adventure/volunteering"]) {
      expect(CATALOG_EXISTING_META[key], key).toBeDefined();
    }
    expect(CATALOG_CORNERS.filter((c) => ["camping", "pilates", "skiing", "storytelling", "surfing", "volunteering"].includes(c.slug))).toEqual([]);
  });
});

describe("alias resolution (getOrCreateCorner)", () => {
  it("a catalog alias returns the catalog slug and name", () => {
    expect(catalogCornerByName("Rock Climbing Gym")).toMatchObject({ slug: "climbing" }); // an alias of the existing Climbing
    const hit = catalogCornerByName("wheel throwing", "crafts-making");
    expect(hit).toEqual({ spaceSlug: "crafts-making", slug: "pottery", name: expect.stringMatching(/pottery/i) });
  });

  it("resolves a catalog Corner by name or by alias, ignoring case and punctuation", () => {
    const c = CATALOG_CORNERS.find((x) => x.aliases.length > 0)!;
    expect(catalogCornerByName(c.name.toUpperCase(), c.spaceSlug)?.slug).toBe(c.slug);
    expect(catalogCornerByName(` ${c.aliases[0]}. `, c.spaceSlug)?.slug).toBe(c.slug);
  });

  it("an alias in another Space does not redirect, and unknown names return undefined", () => {
    expect(catalogCornerByName("wheel throwing", "music")).toBeUndefined();
    expect(catalogCornerByName("zzz not a hobby")).toBeUndefined();
  });
});
