import { afterEach, describe, expect, it } from "vitest";
import catalog from "../data/starterContent.json";
import { matchesStarter, publicStarterLibrary, readStarterBrowse, starterBrowseParams, starterPreviews } from "./starterLibrary";

const original = structuredClone(catalog);
afterEach(() => {
  catalog.resources.splice(0, catalog.resources.length, ...structuredClone(original.resources));
  catalog.pursuits.splice(0, catalog.pursuits.length, ...structuredClone(original.pursuits));
});

describe("public Discover starter library", () => {
  it("exposes the shared directory once per website, independent of carousel membership", () => {
    const library = publicStarterLibrary();
    expect(library.resources).toHaveLength(16);
    expect(library.pursuits).toHaveLength(10);
    expect(library.corners).toHaveLength(10);
    expect(new Set(library.resources.map(r => r.url)).size).toBe(16);
    const previews = starterPreviews(library);
    expect(previews.resources.map(r => r.id)).toEqual(["standard-ebooks", "public-domain-review", "chrome-music-lab"]);
    expect(previews.pursuits.map(p => p.id)).toEqual(["reading-pursuit-01", "painting-pursuit-01"]);
  });

  it("keeps unsafe links, duplicates and adult-only content out of public browsing", () => {
    const base = catalog.resources[0];
    catalog.resources.push({ ...base, id: "duplicate" }, { ...base, id: "unsafe", url: "javascript:alert(1)" }, { ...base, id: "adult", url: "https://example.com/adult", corner_keys: ["food-cooking/home-brewing"] });
    catalog.pursuits.push({ ...catalog.pursuits[0], id: "adult-pursuit", corner_key: "food-cooking/home-brewing" });
    const library = publicStarterLibrary();
    expect(library.resources).toHaveLength(16);
    expect(library.pursuits).toHaveLength(10);
    expect(library.corners.some(c => c.key.includes("home-brewing"))).toBe(false);
    const withoutFeatured = { ...library, resources: library.resources.filter(r => r.id !== "standard-ebooks") };
    expect(starterPreviews(withoutFeatured).resources).toHaveLength(3);
  });

  it("searches names, descriptions and Corner meanings without duplicating multi-Corner sources", () => {
    const library = publicStarterLibrary();
    expect(library.resources.filter(r => matchesStarter(r, "STANDARD", "books-writing/reading")).map(r => r.id)).toEqual(["standard-ebooks"]);
    expect(library.resources.filter(r => matchesStarter(r, "", "books-writing/reading"))).toHaveLength(3);
    const review = library.resources.find(r => r.id === "public-domain-review")!;
    expect(matchesStarter(review, "painting art", "art-creative/watercolor")).toBe(true);
    expect(matchesStarter(review, "", "music/guitar")).toBe(false);
    expect(library.pursuits.filter(p => matchesStarter(p, "small paintings", ""))).toHaveLength(1);
  });

  it("shares collection filters without overwriting existing Discover parameters", () => {
    const params = new URLSearchParams("window=sat-day&m=12&browse=pursuits&browseQuery=paint&browseCorner=art-creative/watercolor");
    expect(readStarterBrowse(params)).toEqual({ kind: "pursuits", query: "paint", corner: "art-creative/painting" });
    const open = starterBrowseParams(params, "resources");
    expect(open.get("window")).toBe("sat-day"); expect(open.get("m")).toBe("12");
    expect(open.get("browse")).toBe("resources"); expect(open.has("browseQuery")).toBe(false);
    expect(starterBrowseParams(params, null).toString()).toBe("window=sat-day&m=12");
    expect(readStarterBrowse(new URLSearchParams("browse=unknown&browseCorner=invalid")).kind).toBeNull();
    expect(readStarterBrowse(new URLSearchParams({ browse: "resources", browseQuery: "x".repeat(500), browseCorner: "invalid" }))).toMatchObject({ query: "x".repeat(160), corner: "" });
  });
});
