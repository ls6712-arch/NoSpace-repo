import { NYC_NEIGHBORHOODS, NYC_RADIUS_KM, type Neighborhood } from "../data/nycNeighborhoods";
import { CITY_MAX } from "./interests";

/** What the "where" screen saves: profile_private.city and .area. */
export interface Place {
  city: string;
  area: string | null;
}

export const NEW_YORK = "New York";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Neighborhoods that start with, or contain a word that starts with, what was typed. */
export function suggestNeighborhoods(typed: string, limit = 5): Neighborhood[] {
  const q = norm(typed);
  if (!q) return [];
  const starts: Neighborhood[] = [];
  const words: Neighborhood[] = [];
  for (const n of NYC_NEIGHBORHOODS) {
    const name = norm(n.name);
    if (name === q) continue;
    if (name.startsWith(q)) starts.push(n);
    else if (name.split(" ").some((w) => w.startsWith(q))) words.push(n);
  }
  return [...starts, ...words].slice(0, limit);
}

/** A known neighborhood typed in full (in any case, with or without the apostrophe). */
export function matchNeighborhood(typed: string): Neighborhood | null {
  const q = norm(typed);
  return q ? (NYC_NEIGHBORHOODS.find((n) => norm(n.name) === q) ?? null) : null;
}

/** A neighborhood is New York with an area; anything else typed is the city, kept as typed. */
export function placeFromTyped(typed: string): Place | null {
  const clean = typed.replace(/\s+/g, " ").trim().slice(0, CITY_MAX);
  if (!clean) return null;
  const known = matchNeighborhood(clean);
  return known ? { city: NEW_YORK, area: known.name } : { city: clean, area: null };
}

const toRad = (d: number) => (d * Math.PI) / 180;
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The nearest listed neighborhood, or null when the position is not in New York. */
export function nearestNeighborhood(pos: { lat: number; lng: number }): Neighborhood | null {
  let best: Neighborhood | null = null;
  let bestKm = Infinity;
  for (const n of NYC_NEIGHBORHOODS) {
    const km = distanceKm(pos, n);
    if (km < bestKm) {
      best = n;
      bestKm = km;
    }
  }
  return best && bestKm <= NYC_RADIUS_KM ? best : null;
}
