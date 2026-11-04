/**
 * Ideas from Soosh's own database (Nov 3, 2026): the person's going Pursuits and the Corners they
 * picked that can be done at home, each linking to its own page in the app. This is what the Stay in
 * hotfix showed (#317), now inside V3, so Stay in never depends on a web search, and every deck can
 * include something of their own. Nothing here is a claim about the outside world: no price, no
 * time but a suggestion, and what each needs (cornerHome.ts) is said plainly instead of an
 * uncertainty ("You'll need flour and a loaf tin").
 */
import { requirementsFit, type Motivation } from "../../_shared/personalization.ts";
import { CORNER_HOME } from "../../_shared/cornerHome.ts";
import { SOOSH_SOURCE } from "./evidence.ts";
import type { Candidate, Context, DiscoveryAdapter } from "./types.ts";

export interface SooshInput {
  /** Their own going Pursuits, with the Corner each is in when known ("space/slug"). */
  pursuits: { id: string; title: string; corner?: string | null }[];
  /** Corner keys they picked, "space/slug". */
  picks: string[];
}

const SAFE = /^[A-Za-z0-9_-]+$/;
const HALF_HOUR = 30 * 60_000;

/** A Corner by key, or by its slug alone when the Space slug is an older one. */
export function cornerOf(key: string | null | undefined) {
  if (!key) return null;
  if (CORNER_HOME[key]) return { key, ...CORNER_HOME[key] };
  const slug = key.split("/").at(-1);
  const found = Object.entries(CORNER_HOME).find(([k]) => k.split("/")[1] === slug);
  return found ? { key: found[0], ...found[1] } : null;
}

/** "You'll need flour and a loaf tin." from a Corner's needs, or null. Lower case after the first word. */
export function needsLine(needs: readonly string[] | undefined): string | null {
  const items = (needs ?? []).map((n) => n.trim().replace(/\.$/, "")).filter(Boolean).slice(0, 3).map((n) => n.charAt(0).toLowerCase() + n.slice(1));
  if (items.length === 0) return null;
  const list = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  return `You’ll need ${list}.`.slice(0, 200);
}

/** A suggested time inside the window: the next half hour from when they could start. */
function suggestedStart(ctx: Context): number | null {
  const from = Math.max(ctx.window.startMs, ctx.now + 15 * 60_000);
  const at = Math.ceil(from / HALF_HOUR) * HALF_HOUR;
  return at < ctx.window.endMs ? at : null;
}

export function sooshCandidates(input: SooshInput, ctx: Context): Candidate[] {
  const startsAt = suggestedStart(ctx);
  if (startsAt === null) return [];
  const evidence = (url: string) => [{ url, level: "provider" as const, source: SOOSH_SOURCE, checkedAt: ctx.now }];
  const out: Candidate[] = [];
  const factsFor = (corner: ReturnType<typeof cornerOf>) => {
    const facts = corner?.facts;
    const requirements = facts?.resources;
    const owned = requirements && requirementsFit(requirements, ctx.equipment);
    return { timing: "suggested" as const,
      traits: facts ? { ...facts, motivations: facts.motivations as Motivation[], social: facts.social as "solo" | "together" | "either" } : undefined,
      resources: requirements,
      cost: facts?.costMode === "free" || (facts?.costMode === "owned_resources" && owned) ? { max: 0, currency: "USD" as const } : null };
  };
  const used = new Set<string>();
  for (const p of input.pursuits.slice(0, 10)) {
    const title = p.title.trim().slice(0, 80);
    if (!SAFE.test(p.id) || !title) continue;
    const corner = cornerOf(p.corner);
    if (corner) used.add(corner.key);
    out.push({
      id: `pursuit-${p.id}`, title, kind: "idea", startsAt, endsAt: null,
      city: ctx.city, place: null, setting: corner?.atHome ? "home" : "unknown",
      // Their own Pursuit costs nothing to work on; what it needs is said in needs, never as "free".
      ...factsFor(corner), status: "scheduled", availability: "available",
      equipment: [], membership: null, minAge: 0, travelMinutes: corner?.atHome ? 0 : null,
      tags: ["pursuit", ...(corner ? [corner.name.toLowerCase()] : [])],
      evidence: evidence(`/pursuit/${p.id}`), needs: corner?.needs ?? [],
    });
  }
  for (const k of input.picks.slice(0, 20)) {
    const corner = cornerOf(k);
    if (!corner || used.has(corner.key) || !corner.atHome) continue;
    const [space, slug] = corner.key.split("/");
    if (!SAFE.test(space) || !SAFE.test(slug)) continue;
    used.add(corner.key);
    out.push({
      id: `corner-${space}-${slug}`, title: `${corner.name} at home`.slice(0, 80), kind: "idea", startsAt, endsAt: null,
      city: ctx.city, place: null, setting: "home", ...factsFor(corner), status: "scheduled", availability: "available",
      equipment: [], membership: null, minAge: 0, travelMinutes: 0,
      tags: ["corner", corner.name.toLowerCase()], evidence: evidence(`/start/${space}/${slug}`), needs: corner.needs,
    });
  }
  return out;
}

export function sooshAdapter(input: SooshInput): DiscoveryAdapter {
  return { id: SOOSH_SOURCE, discover: async (ctx) => sooshCandidates(input, ctx) };
}
