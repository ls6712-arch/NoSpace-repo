// A small in-memory PostgREST emulator, just enough for supabase-js to read
// fixture rows through Playwright's page.route — no app changes, no network.
//
// Reads: select (columns, aliases, embedded resources via the foreign keys in
// database.types.ts), eq/neq/in/is/gt/gte/lt/lte/like/ilike/not, or=(…),
// order, limit/offset, count=exact, and the single-object Accept header.
// Writes are acknowledged but not stored: every screenshot starts from the
// same fixture state.
import fs from "node:fs";
import type { Database } from "./database.types.ts";

export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Fixtures = { [K in keyof Tables]?: Row<K>[] };
export type AnyRow = Record<string, unknown>;

export interface Fk { table: string; columns: string[]; refTable: string; refColumns: string[] }

/** Foreign keys parsed from the generated types' Relationships blocks. */
export function parseForeignKeys(typesPath: string): Fk[] {
  const text = fs.readFileSync(typesPath, "utf8");
  const out: Fk[] = [];
  const tableRx = /\n      (\w+): \{\n        Row: \{/g;
  const starts: { name: string; at: number }[] = [];
  for (let m; (m = tableRx.exec(text)); ) starts.push({ name: m[1], at: m.index });
  starts.forEach((s, i) => {
    const body = text.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : undefined);
    const relRx = /columns: \[([^\]]*)\]\n\s+isOneToOne: \w+\n\s+referencedRelation: "(\w+)"\n\s+referencedColumns: \[([^\]]*)\]/g;
    for (let r; (r = relRx.exec(body)); ) {
      const cols = (x: string) => x.split(",").map((c) => c.trim().replace(/"/g, "")).filter(Boolean);
      out.push({ table: s.name, columns: cols(r[1]), refTable: r[2], refColumns: cols(r[3]) });
    }
  });
  return out;
}

const splitTop = (s: string, sep = ","): string[] => {
  const parts: string[] = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) parts.push(cur); return parts;
};

type Cmp = (row: AnyRow) => boolean;
const val = (v: string): unknown => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);
/** Numeric when both sides are numbers, otherwise string order (ISO timestamps sort correctly). */
const order = (a: unknown, b: string): number => (typeof a === "number" || /^-?\d+(\.\d+)?$/.test(b) && a !== null ? Number(a) - Number(b) : String(a ?? "").localeCompare(b));
const eqLoose = (a: unknown, b: string) => (a === null || a === undefined ? b === "null" : String(a) === b);

function parseFilter(col: string, expr: string): Cmp {
  const neg = expr.startsWith("not.");
  const e = neg ? expr.slice(4) : expr;
  const dot = e.indexOf("."); const op = e.slice(0, dot); const arg = e.slice(dot + 1);
  const test: Cmp = (row) => {
    const v = row[col];
    switch (op) {
      case "eq": return eqLoose(v, arg);
      case "neq": return !eqLoose(v, arg);
      case "is": return arg === "null" ? v == null : String(v) === arg;
      case "in": return splitTop(arg.replace(/^\(|\)$/g, "")).map((x) => x.replace(/^"|"$/g, "")).includes(String(v));
      case "gt": return order(v, arg) > 0;
      case "gte": return order(v, arg) >= 0;
      case "lt": return order(v, arg) < 0;
      case "lte": return order(v, arg) <= 0;
      case "like": case "ilike": return new RegExp("^" + arg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", op === "ilike" ? "i" : "").test(String(v ?? ""));
      case "cs": return Array.isArray(v) && arg.replace(/^\{|\}$/g, "").split(",").every((x) => (v as unknown[]).map(String).includes(x));
      default: return true; // unknown operator: don't hide rows the screen expects
    }
  };
  return neg ? (r) => !test(r) : test;
}

function parseOr(expr: string): Cmp {
  const alts = splitTop(expr.replace(/^\(|\)$/g, "")).map((a) => { const i = a.indexOf("."); return parseFilter(a.slice(0, i), a.slice(i + 1)); });
  return (row) => alts.some((f) => f(row));
}

export interface Ctx { fixtures: Fixtures; fks: Fk[] }
const RESERVED = new Set(["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns", "returning"]);

function embedRows(ctx: Ctx, base: string, row: AnyRow, target: string, hint: string | undefined): { value: AnyRow | AnyRow[] | null; many: boolean } {
  const rows = (ctx.fixtures as Record<string, AnyRow[]>)[target] ?? [];
  // base -> target (many-to-one): the base table holds the foreign key.
  const toOne = ctx.fks.filter((f) => f.table === base && f.refTable === target && (!hint || hint === f.columns[0] || hint.includes(f.columns[0])));
  if (toOne.length) { const f = toOne[0]; return { value: rows.find((r) => f.columns.every((c, i) => r[f.refColumns[i]] === row[c])) ?? null, many: false }; }
  // target -> base (one-to-many): the target table holds the foreign key.
  const toMany = ctx.fks.filter((f) => f.table === target && f.refTable === base && (!hint || hint === f.columns[0] || hint.includes(f.columns[0])));
  if (toMany.length) { const f = toMany[0]; return { value: rows.filter((r) => f.columns.every((c, i) => r[c] === row[f.refColumns[i]])), many: true }; }
  return { value: null, many: false };
}

interface SelItem { kind: "col" | "star" | "embed"; name: string; alias?: string; target?: string; hint?: string; inner?: boolean; sub?: string }
function parseSelect(sel: string): SelItem[] {
  return splitTop(sel || "*").map((raw) => {
    const s = raw.trim(); if (s === "*") return { kind: "star", name: "*" } as SelItem;
    const open = s.indexOf("(");
    if (open < 0) { const [alias, col] = s.includes(":") ? s.split(":") : [undefined, s]; return { kind: "col", name: col.split("::")[0], alias } as SelItem; }
    let head = s.slice(0, open); const sub = s.slice(open + 1, s.lastIndexOf(")"));
    let alias: string | undefined; if (head.includes(":")) [alias, head] = head.split(":");
    const [target, ...mods] = head.split("!"); const inner = mods.includes("inner"); const hint = mods.find((m) => m !== "inner" && m !== "left");
    return { kind: "embed", name: target, alias, target, hint, inner, sub } as SelItem;
  });
}

function project(ctx: Ctx, base: string, row: AnyRow, items: SelItem[], embedFilters: Map<string, Cmp[]>): AnyRow | null {
  const out: AnyRow = {};
  for (const it of items) {
    if (it.kind === "star") Object.assign(out, row);
    else if (it.kind === "col") out[it.alias ?? it.name] = row[it.name];
    else {
      const { value, many } = embedRows(ctx, base, row, it.target!, it.hint);
      const filters = embedFilters.get(it.alias ?? it.name) ?? embedFilters.get(it.name) ?? [];
      const sub = parseSelect(it.sub ?? "*");
      const shape = (r: AnyRow) => project(ctx, it.target!, r, sub, new Map());
      if (many) { const list = (value as AnyRow[]).filter((r) => filters.every((f) => f(r))).map(shape); out[it.alias ?? it.name] = list; }
      else {
        const ok = value && filters.every((f) => f(value as AnyRow));
        if (!ok && it.inner) return null;
        out[it.alias ?? it.name] = ok ? shape(value as AnyRow) : null;
      }
    }
  }
  return out;
}

export interface Reply { status: number; headers: Record<string, string>; body: string }
const J = (status: number, data: unknown, headers: Record<string, string> = {}): Reply => ({ status, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(data) });

export function select(ctx: Ctx, table: string, url: URL, accept: string, wantCount: boolean): Reply {
  const source = (ctx.fixtures as Record<string, AnyRow[]>)[table];
  if (!source) return J(404, { code: "42P01", message: `fixture table "${table}" not provided`, details: null, hint: null });
  const items = parseSelect(url.searchParams.get("select") ?? "*");
  const embedNames = new Set(items.filter((i) => i.kind === "embed").flatMap((i) => [i.name, i.alias ?? i.name]));
  const preds: Cmp[] = []; const embedFilters = new Map<string, Cmp[]>();
  for (const [k, v] of url.searchParams) {
    if (k === "or") { preds.push(parseOr(v)); continue; }
    if (RESERVED.has(k)) continue;
    const dot = k.indexOf(".");
    if (dot > 0 && embedNames.has(k.slice(0, dot))) { const key = k.slice(0, dot); embedFilters.set(key, [...(embedFilters.get(key) ?? []), parseFilter(k.slice(dot + 1), v)]); continue; }
    preds.push(parseFilter(k, v));
  }
  let rows = source.filter((r) => preds.every((p) => p(r)));
  const order = url.searchParams.get("order");
  if (order) {
    const keys = splitTop(order).map((o) => { const [c, ...m] = o.split("."); return { c, desc: m.includes("desc") }; });
    rows = [...rows].sort((a, b) => { for (const k of keys) { const x = a[k.c] as never, y = b[k.c] as never; if (x === y) continue; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : 1) * (k.desc ? -1 : 1); } return 0; });
  }
  const total = rows.length;
  const off = Number(url.searchParams.get("offset") ?? 0); const lim = url.searchParams.get("limit");
  rows = rows.slice(off, lim ? off + Number(lim) : undefined);
  const shaped = rows.map((r) => project(ctx, table, r, items, embedFilters)).filter((r): r is AnyRow => r !== null);
  const range = shaped.length ? `${off}-${off + shaped.length - 1}/${wantCount ? total : "*"}` : `*/${wantCount ? total : "*"}`;
  if (accept.includes("vnd.pgrst.object")) {
    return shaped.length === 1 ? J(200, shaped[0], { "content-range": range })
      : J(406, { code: "PGRST116", details: `The result contains ${shaped.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
  }
  return J(200, shaped, { "content-range": range });
}

export const empty = (status = 204): Reply => ({ status, headers: {}, body: "" });
export { J as json };
