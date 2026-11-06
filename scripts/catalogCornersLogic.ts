/**
 * Pure logic behind scripts/build-catalog-corners.ts: parse the founder's CSV,
 * keep only `keep` rows, and merge each row into an existing Corner when one
 * already exists ("the existing Corner always wins").
 */
import { matchCorners } from "../src/app/lib/cornerMatching";

export type NycFit = "city" | "seasonal" | "day_trip" | "hard";
export type Season = "warm" | "mild" | "cold";

/** internal_category name in the CSV to the hobbies.ts Space slug. Listed in the PR. */
export const INTERNAL_CATEGORY_TO_SPACE: Readonly<Record<string, string>> = {
  "Food & Cooking": "food-cooking",
  "Sports & Fitness": "sports-fitness",
  "Art & Creative": "art-creative",
  "Crafts & Making": "crafts-making",
  "Books & Writing": "books-writing",
  "Nature & Outdoors": "nature-outdoors",
  "Home & Garden": "home-garden",
  "Gaming & Tabletop": "gaming-tabletop",
  "Music": "music",
  "Photography & Film": "photography-film",
  "Health & Wellness": "health-wellness",
  "Fashion & Beauty": "fashion-beauty",
  "Tech & Building": "tech-building",
  "Collecting & Fandom": "collecting-fandom",
  "Travel & Adventure": "travel-adventure",
};

export interface CsvRow {
  name: string;
  slug: string;
  internal_category: string;
  nyc_fit: string;
  season: string;
  status: string;
  aliases: string;
  note: string;
}

export interface CatalogEntry {
  slug: string;
  name: string;
  spaceSlug: string;
  aliases: string[];
  nycFit: NycFit;
  season?: Season;
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

export function csvRows(text: string): CsvRow[] {
  const [header, ...body] = parseCsv(text);
  return body.map((cells) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h.trim()] = (cells[i] ?? "").trim()));
    return o as unknown as CsvRow;
  });
}

const NYC_FITS = new Set(["city", "seasonal", "day_trip", "hard"]);
const SEASONS = new Set(["warm", "mild", "cold"]);

/** `keep` rows only; throws on anything malformed so a bad CSV never ships. */
export function keptEntries(rows: CsvRow[]): CatalogEntry[] {
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const r of rows) {
    if (r.status !== "keep") continue;
    const spaceSlug = INTERNAL_CATEGORY_TO_SPACE[r.internal_category];
    if (!spaceSlug) throw new Error(`${r.slug}: unknown internal_category "${r.internal_category}"`);
    if (!NYC_FITS.has(r.nyc_fit)) throw new Error(`${r.slug}: bad nyc_fit "${r.nyc_fit}"`);
    if (r.season && !SEASONS.has(r.season)) throw new Error(`${r.slug}: bad season "${r.season}"`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) throw new Error(`bad slug "${r.slug}"`);
    if (seen.has(r.slug)) throw new Error(`duplicate slug "${r.slug}"`);
    seen.add(r.slug);
    out.push({
      slug: r.slug,
      name: r.name,
      spaceSlug,
      aliases: r.aliases ? r.aliases.split(";").map((a) => a.trim()).filter(Boolean) : [],
      nycFit: r.nyc_fit as NycFit,
      season: (r.season || undefined) as Season | undefined,
    });
  }
  return out;
}

export interface ExistingCorner {
  spaceSlug: string;
  slug: string;
  name: string;
}

export type MatchRule = "override" | "same-slug" | "name-or-alias" | "fuzzy";

export interface MergeMatch {
  catalog: CatalogEntry;
  existing: ExistingCorner;
  rule: MatchRule;
  /** Set on a follow-on match: the matched Corner had itself been merged away (hobbies.ts MERGED_CORNERS) and `existing` is the one kept. */
  via?: ExistingCorner;
}

export interface ExistingMeta {
  nycFit: NycFit;
  season?: Season;
}

export interface MergeResult {
  /** Catalog entries that become catalog Corners. */
  fresh: CatalogEntry[];
  /** Matched entries: the existing Corner wins; aliases are added to it. */
  merged: MergeMatch[];
  /** Same slug or same name in another Space. Listed, never merged, and held out of the catalog. */
  crossSpace: MergeMatch[];
  /** Follow-on matches that would land in a narrower Corner (Singing into Choir). Decisions for the founder: nothing is applied and no catalog row is created. */
  followOn: MergeMatch[];
  /** Same-Space fuzzy matches (matchesFor's rule). Too loose to merge unasked: listed, and the entry is still created. */
  suggested: MergeMatch[];
  /** "space/slug" of the existing Corner to the extra aliases it gains. */
  aliasAdditions: Record<string, string[]>;
  /** "space/slug" of an existing Corner to the catalog's nyc_fit and season for it (merged and held-out rows alike). */
  existingMeta: Record<string, ExistingMeta>;
}

const lc = (s: string) => s.trim().toLowerCase();

export interface MergeOptions {
  /** catalog slug to "space/slug" of the existing Corner the founder approved merging into. */
  overrides?: Readonly<Record<string, string>>;
  /** Catalog slugs the founder wants created even though an alias matches a narrower existing Corner (Playing an instrument vs Guitar). */
  keepSeparate?: readonly string[];
  /** Catalog slugs whose follow-on match the founder approved (Singing into Choir and singing). */
  acceptFollowOn?: readonly string[];
  /** Follows hobbies.ts MERGED_CORNERS: a Corner merged away resolves to the one kept. */
  canonical?: (spaceSlug: string, slug: string) => { spaceSlug: string; slug: string };
}

/**
 * Match order (brief 3.2): same slug in the same Space; catalog name or alias
 * equals an existing Corner name; the fuzzy rule matchesFor uses.
 *
 * Deviation, flagged in the PR: the fuzzy rule alone would fold Ice hockey into
 * Roller and ice skating, so it only suggests. Rules 1 and 2 merge, and so do
 * founder-approved overrides. Other-Space matches on rules 1 and 2 are listed
 * and held out of the catalog, but the existing Corner still gains their aliases, nyc_fit and
 * season; a match on a Corner that was itself merged away (Singing, now Choir and singing) is
 * a follow-on decision: listed, nothing applied; other-Space fuzzy matches are noise and are not reported.
 */
export function mergeCatalog(entries: CatalogEntry[], existing: ExistingCorner[], opts: MergeOptions = {}): MergeResult {
  const fresh: CatalogEntry[] = [];
  const merged: MergeMatch[] = [];
  const crossSpace: MergeMatch[] = [];
  const suggested: MergeMatch[] = [];
  const followOn: MergeMatch[] = [];
  const aliasAdditions: Record<string, string[]> = {};
  const existingMeta: Record<string, ExistingMeta> = {};
  const metaSource: Record<string, string> = {};
  const canon = opts.canonical ?? ((spaceSlug: string, slug: string) => ({ spaceSlug, slug }));

  const strict = (e: CatalogEntry, pool: ExistingCorner[]): { existing: ExistingCorner; rule: MatchRule } | undefined => {
    const bySlug = pool.find((x) => x.slug === e.slug);
    if (bySlug) return { existing: bySlug, rule: "same-slug" };
    const names = new Set([lc(e.name), ...e.aliases.map(lc)]);
    const byName = pool.find((x) => names.has(lc(x.name)));
    if (byName) return { existing: byName, rule: "name-or-alias" };
    return undefined;
  };

  // The existing Corner gains the row's names, nyc_fit and season. Where several rows land on one
  // Corner, the row with the Corner's own slug supplies nyc_fit and season, else the first.
  const give = (e: CatalogEntry, winner: ExistingCorner) => {
    const key = `${winner.spaceSlug}/${winner.slug}`;
    const add = [e.name, ...e.aliases].filter((a) => lc(a) !== lc(winner.name));
    aliasAdditions[key] = [...new Set([...(aliasAdditions[key] ?? []), ...add])];
    if (!existingMeta[key] || (e.slug === winner.slug && metaSource[key] !== winner.slug)) {
      existingMeta[key] = { nycFit: e.nycFit, ...(e.season ? { season: e.season } : {}) };
      metaSource[key] = e.slug;
    }
  };

  const take = (e: CatalogEntry, hit: ExistingCorner, rule: MatchRule) => {
    const k = canon(hit.spaceSlug, hit.slug);
    const winner = existing.find((x) => x.spaceSlug === k.spaceSlug && x.slug === k.slug) ?? hit;
    if (winner !== hit && rule !== "override" && !opts.acceptFollowOn?.includes(e.slug)) {
      followOn.push({ catalog: e, existing: winner, rule, via: hit });
      return;
    }
    merged.push({ catalog: e, existing: winner, rule, ...(winner !== hit ? { via: hit } : {}) });
    give(e, winner);
  };

  for (const e of entries) {
    const approved = opts.overrides?.[e.slug];
    if (approved) {
      const hit = existing.find((x) => `${x.spaceSlug}/${x.slug}` === approved);
      if (!hit) throw new Error(`override for ${e.slug} points at unknown Corner ${approved}`);
      take(e, hit, "override");
      continue;
    }
    const sameSpace = existing.filter((x) => x.spaceSlug === e.spaceSlug);
    if (opts.keepSeparate?.includes(e.slug)) {
      fresh.push(e);
      continue;
    }
    const hit = strict(e, sameSpace);
    if (hit) {
      take(e, hit.existing, hit.rule);
      continue;
    }
    const other = strict(e, existing.filter((x) => x.spaceSlug !== e.spaceSlug));
    if (other) {
      crossSpace.push({ catalog: e, existing: other.existing, rule: other.rule });
      give(e, other.existing);
      continue;
    }
    const fuzzy = matchCorners(sameSpace.map((x) => ({ ...x })), e.name)[0];
    if (fuzzy) suggested.push({ catalog: e, existing: fuzzy, rule: "fuzzy" });
    fresh.push(e);
  }
  return { fresh, merged, crossSpace, suggested, followOn, aliasAdditions, existingMeta };
}

/** The generated file's text. Stable output so a re-run with no CSV change is a no-op diff. */
export function renderCatalogFile(result: MergeResult): string {
  const entries = [...result.fresh].sort((a, b) => a.slug.localeCompare(b.slug));
  const q = (s: string) => JSON.stringify(s);
  const lines = entries.map((e) => {
    const parts = [
      `slug: ${q(e.slug)}`,
      `name: ${q(e.name)}`,
      `spaceSlug: ${q(e.spaceSlug)}`,
      `aliases: [${e.aliases.map(q).join(", ")}]`,
      `nycFit: ${q(e.nycFit)}`,
    ];
    if (e.season) parts.push(`season: ${q(e.season)}`);
    return `  { ${parts.join(", ")} },`;
  });
  const adds = Object.keys(result.aliasAdditions)
    .sort()
    .map((k) => `  ${q(k)}: [${result.aliasAdditions[k].map(q).join(", ")}],`);
  const metas = Object.keys(result.existingMeta)
    .sort()
    .map((k) => {
      const m = result.existingMeta[k];
      return `  ${q(k)}: { nycFit: ${q(m.nycFit)}${m.season ? `, season: ${q(m.season)}` : ""} },`;
    });
  return `// GENERATED FILE. DO NOT EDIT.
// Source: data/corners_catalog.csv. Regenerate with: npx tsx scripts/build-catalog-corners.ts
// Only rows with status "keep" are loaded. Rows that match an existing Corner are
// not listed here; their aliases are in CATALOG_ALIAS_ADDITIONS and their nyc_fit and
// season in CATALOG_EXISTING_META instead. The same goes for a row held out because the
// same hobby already exists in another Space.

export type NycFit = "city" | "seasonal" | "day_trip" | "hard";
export type Season = "warm" | "mild" | "cold";

export interface CatalogCorner {
  slug: string;
  name: string;
  spaceSlug: string;
  aliases: string[];
  nycFit: NycFit;
  season?: Season;
}

export const CATALOG_CORNERS: readonly CatalogCorner[] = [
${lines.join("\n")}
];

/** "space/slug" of an existing Corner to the extra names people may call it. */
export const CATALOG_ALIAS_ADDITIONS: Readonly<Record<string, readonly string[]>> = {
${adds.join("\n")}
};

/** "space/slug" of an existing Corner to the catalog's nyc_fit and season for it. */
export const CATALOG_EXISTING_META: Readonly<Record<string, { nycFit: NycFit; season?: Season }>> = {
${metas.join("\n")}
};
`;
}
