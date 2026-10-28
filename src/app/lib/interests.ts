import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { MOODS, type MoodId } from "../data/moods";

/**
 * What a person wants more of (the moods in data/moods.ts) and the city
 * Discover is "this week in". Moods are stored on profiles.moods (public), the
 * city in profile_private.city (readable only by its owner), migration
 * 20261030000000. Both are mirrored in localStorage, so Discover works before
 * that migration is live, for a signed-out visitor, and offline.
 *
 * Read and written apart from the main profile load on purpose: asking for a
 * column the database does not have yet fails the whole select, and nobody
 * should lose their profile over it.
 */
export interface Interests {
  city: string;
  moods: MoodId[];
}

export const EMPTY_INTERESTS: Interests = { city: "", moods: [] };
export const CITY_MAX = 80;

/** Cities offered while typing. Anything else typed is kept as it is. */
export const CITY_SUGGESTIONS = ["Bangalore", "New York", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "London", "San Francisco", "Los Angeles"];

const STORAGE_KEY = "soosh.interests.v1";
const CHANGED = "soosh:interests-changed";
const KNOWN = new Set<string>(MOODS.map((m) => m.id));

export function cleanCity(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, CITY_MAX);
}

/** Known mood ids only, each once, in the order the moods are listed. */
export function cleanMoods(raw: unknown): MoodId[] {
  const picked = new Set(Array.isArray(raw) ? raw.filter((m): m is string => typeof m === "string" && KNOWN.has(m)) : []);
  return MOODS.filter((m) => picked.has(m.id)).map((m) => m.id);
}

export function suggestCities(typed: string, limit = 4): string[] {
  const q = typed.trim().toLowerCase();
  if (!q) return CITY_SUGGESTIONS.slice(0, limit);
  return CITY_SUGGESTIONS.filter((c) => c.toLowerCase().startsWith(q) && c.toLowerCase() !== q).slice(0, limit);
}

export function readLocalInterests(): Interests | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Interests>;
    return { city: cleanCity(typeof v.city === "string" ? v.city : ""), moods: cleanMoods(v.moods) };
  } catch {
    return null;
  }
}

function writeLocalInterests(next: Interests) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the saved profile is still the source of truth.
  }
}

// Moods are public (profiles.moods); the city is private (profile_private.city,
// readable and writable only by its owner). Each is read and written on its own,
// so one missing (its migration has not run) leaves the other working.
// 42703 is Postgres's "no such column"; 42P01 and PGRST205 are "no such table".
let moodsMissing = false;
let cityMissing = false;
const noTable = (code?: string) => code === "42P01" || code === "PGRST205";

export async function fetchMyInterests(userId: string): Promise<Interests | null> {
  if (!supabase) return null;
  const client = supabase;
  const [moodsRes, cityRes] = await Promise.all([
    moodsMissing ? null : client.from("profiles").select("moods").eq("id", userId).maybeSingle(),
    cityMissing ? null : client.from("profile_private").select("city").eq("user_id", userId).maybeSingle(),
  ]);
  if (moodsRes?.error?.code === "42703") moodsMissing = true;
  if (cityRes?.error && noTable(cityRes.error.code)) cityMissing = true;
  const moods = moodsRes && !moodsRes.error ? cleanMoods((moodsRes.data as { moods: string[] | null } | null)?.moods) : null;
  const city = cityRes && !cityRes.error ? cleanCity((cityRes.data as { city: string | null } | null)?.city ?? "") : null;
  if (moods === null && city === null) return null;
  return { city: city ?? "", moods: moods ?? [] };
}

export async function saveMyInterests(userId: string, next: Interests): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const client = supabase;
  let error: string | null = null;
  if (!moodsMissing) {
    const { error: e } = await client.from("profiles").update({ moods: next.moods }).eq("id", userId);
    if (e?.code === "42703") moodsMissing = true;
    else if (e) error = e.message;
  }
  if (!cityMissing) {
    const { error: e } = await client
      .from("profile_private")
      .upsert({ user_id: userId, city: next.city || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (e && noTable(e.code)) cityMissing = true;
    else if (e) error = error ?? e.message;
  }
  return { error };
}

/** Test hook: forget what was learned about the columns and table. */
export function resetInterestsCache() {
  moodsMissing = false;
  cityMissing = false;
}

export function useInterests() {
  const { user } = useAuth();
  const [interests, setInterests] = useState<Interests>(() => readLocalInterests() ?? EMPTY_INTERESTS);

  useEffect(() => {
    const onChanged = () => setInterests(readLocalInterests() ?? EMPTY_INTERESTS);
    window.addEventListener(CHANGED, onChanged);
    return () => window.removeEventListener(CHANGED, onChanged);
  }, []);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchMyInterests(user.id).then((saved) => {
      if (!live || !saved) return;
      // A saved profile with nothing in it does not wipe what this device already knows.
      if (saved.city === "" && saved.moods.length === 0) return;
      writeLocalInterests(saved);
      setInterests(saved);
    });
    return () => {
      live = false;
    };
  }, [user?.id]);

  /** Saves on this device first, then to the profile. Resolves to an error line, or null. */
  const save = useCallback(
    async (next: Interests): Promise<string | null> => {
      const clean = { city: cleanCity(next.city), moods: cleanMoods(next.moods) };
      writeLocalInterests(clean);
      setInterests(clean);
      window.dispatchEvent(new Event(CHANGED));
      if (!user) return null;
      return (await saveMyInterests(user.id, clean)).error;
    },
    [user?.id],
  );

  return { ...interests, save, hasPicked: interests.moods.length > 0 };
}
