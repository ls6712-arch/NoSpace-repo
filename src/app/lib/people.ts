import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Finding people.
 *
 * The rest of NoSpace deliberately routes you Person → Hobby → People, and
 * that stays true: the primary way you meet someone is by being in the same
 * craft. But "I can't find my friend who just joined" is not a principle, it's
 * a bug, so a name search exists too.
 *
 * Two sources say a person belongs to a hobby, and neither is a follow:
 * they've posted in it, or they're exploring it. Both are things they did,
 * which is why nobody has to fill in an interests list to be discoverable.
 */
export type Person = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl?: string;
  /** Hobby slugs and "space:<slug>" keys this person is present in. */
  hobbyKeys: string[];
  postCount: number;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * A slow network shouldn't leave someone staring at "Looking…" forever. Every
 * query here is wrapped so the UI always lands on a real state.
 */
function withTimeout<T>(promise: PromiseLike<T>, fallback: T, ms = 8000): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function toPerson(row: ProfileRow): Person {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name?.trim() || "Someone",
    avatarUrl: row.avatar_url ?? undefined,
    hobbyKeys: [],
    postCount: 0,
  };
}

/** Where a person's profile lives. Username is prettier; id always works. */
export function profilePath(person: { username?: string | null; id: string }) {
  return `/u/${encodeURIComponent(person.username || person.id)}`;
}

/**
 * Attaches hobby presence and a post count to a set of profiles, so a person
 * card can say what they actually do rather than how many followers they have.
 */
async function decorate(people: Person[]): Promise<Person[]> {
  if (!supabase || people.length === 0) return people;
  const ids = people.map((p) => p.id);

  let postRows: any[] | null = null;
  let followRows: any[] | null = null;
  try {
    const [posts, follows] = await Promise.all([
      supabase.from("posts").select("user_id, hobby_slug").in("user_id", ids).eq("visibility", "public"),
      supabase.from("hobby_follows").select("user_id, hobby_key").in("user_id", ids),
    ]);
    postRows = posts.data as any[] | null;
    followRows = follows.data as any[] | null;
  } catch {
    // The people are still worth showing without their hobby tags.
    return people;
  }

  const byId = new Map(people.map((p) => [p.id, { ...p, hobbyKeys: [] as string[], postCount: 0 }]));

  for (const row of postRows ?? []) {
    const p = byId.get((row as any).user_id);
    if (!p) continue;
    p.postCount += 1;
    const slug = (row as any).hobby_slug as string;
    if (slug && !p.hobbyKeys.includes(slug)) p.hobbyKeys.push(slug);
  }
  for (const row of followRows ?? []) {
    const p = byId.get((row as any).user_id);
    if (!p) continue;
    const key = ((row as any).hobby_key as string)?.replace(/^space:/, "");
    if (key && !p.hobbyKeys.includes(key)) p.hobbyKeys.push(key);
  }

  return [...byId.values()];
}

/** Search people by the name they chose, or their handle. */
export async function searchPeople(query: string, limit = 12): Promise<Person[]> {
  const q = query.trim();
  if (!supabase || q.length < 2) return [];

  const escaped = q.replace(/[%_,()]/g, " ").trim();
  if (!escaped) return [];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`display_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
      .limit(limit);

    if (error || !data) return [];
    return await decorate((data as ProfileRow[]).map(toPerson));
  } catch {
    // Offline, or the database is unreachable. An empty result reads as
    // "nobody by that name", which is wrong but recoverable; a spinner that
    // never stops is not.
    return [];
  }
}

/**
 * Everyone present in one hobby — those who've posted in it, and those
 * exploring it. Ordered by how much of their work lives there, so the page
 * leads with people actually doing the thing rather than whoever signed up
 * first. No counts are shown to anyone; this only decides an order.
 */
export async function peopleInHobby(hobbySlug: string, limit = 12): Promise<Person[]> {
  if (!supabase) return [];

  let postRows: any[] | null = null;
  let followRows: any[] | null = null;
  try {
    const [posts, follows] = await Promise.all([
      supabase.from("posts").select("user_id").eq("hobby_slug", hobbySlug).eq("visibility", "public"),
      supabase
        .from("hobby_follows")
        .select("user_id")
        .in("hobby_key", [hobbySlug, `space:${hobbySlug}`]),
    ]);
    postRows = posts.data as any[] | null;
    followRows = follows.data as any[] | null;
  } catch {
    return [];
  }

  const ids = [
    ...new Set([
      ...(postRows ?? []).map((r: any) => r.user_id as string),
      ...(followRows ?? []).map((r: any) => r.user_id as string),
    ]),
  ].filter(Boolean);

  if (ids.length === 0) return [];

  let data: ProfileRow[] | null = null;
  try {
    const res = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids.slice(0, 60));
    data = res.data as ProfileRow[] | null;
  } catch {
    return [];
  }
  if (!data) return [];
  const people = await decorate(data.map(toPerson));
  return people
    .sort((a, b) => b.postCount - a.postCount || a.displayName.localeCompare(b.displayName))
    .slice(0, limit);
}

/** Debounced people search, safe to call on every keystroke. */
export function usePeopleSearch(query: string) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await withTimeout(searchPeople(q), [] as Person[]);
      if (cancelled) return;
      setPeople(found);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return { people, loading };
}

/** Everyone in one hobby, fetched once per slug. */
export function usePeopleInHobby(hobbySlug: string) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    withTimeout(peopleInHobby(hobbySlug), [] as Person[]).then((found) => {
      if (cancelled) return;
      setPeople(found);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hobbySlug]);

  return { people, loading };
}
