import catalog from "../data/starterContent.json";
import { canonicalCorner, isBrowsableCorner } from "../data/hobbies";
import type { Workflow } from "./pursuitWorkflow";

export type StarterActivity = typeof catalog.activities[number];
export type StarterPursuit = typeof catalog.pursuits[number];
export type CornerResource = typeof catalog.resources[number];

function canonicalKey(key: string) {
  const [space, slug] = key.split("/");
  const corner = canonicalCorner(space, slug);
  return `${corner.spaceSlug}/${corner.slug}`;
}

/** Public editorial content only. Never reads a person's preferences or progress. */
export function starterContentFor(spaceSlug: string, slug: string) {
  const corner = canonicalCorner(spaceSlug, slug);
  const key = `${corner.spaceSlug}/${corner.slug}`;
  if (!isBrowsableCorner(corner.spaceSlug, corner.slug)) return { activities: [], pursuits: [], resources: [], cover: undefined };
  return {
    activities: catalog.activities.filter(item => canonicalKey(item.corner_key) === key),
    pursuits: catalog.pursuits.filter(item => canonicalKey(item.corner_key) === key),
    resources: catalog.resources.filter(item => item.corner_keys.some(k => canonicalKey(k) === key) && isSafeResourceUrl(item.url)),
    cover: catalog.covers.find(item => canonicalKey(item.corner_key) === key),
  };
}

export function isSafeResourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

export function starterPursuit(id: string | null): StarterPursuit | undefined {
  return catalog.pursuits.find(item => item.id === id);
}

export function starterPursuitPath(item: StarterPursuit) {
  return `/pursuits/new?${new URLSearchParams({ template: item.id })}`;
}

/** Copies editable step names, never completion, members, deadlines or identity. */
export function starterWorkflow(item: StarterPursuit): Workflow {
  return {
    version: 2, tracking: "checklist", unit: "", items: item.milestones.map(step => ({ id: crypto.randomUUID(), title: `${step.title}: ${step.instruction}` })),
  };
}
