import { supabase } from "../../lib/supabase";
import { ERROR_LINE, LOAD_ERROR_LINE } from "./stateCopy";
import { dropFromRow, type Drop } from "./drops";

/** What the admin form holds. Times are the device's own, as a datetime-local field gives them ("2026-11-24T19:00"). */
export interface DropInput {
  title: string;
  slug: string;
  blurb: string;
  cornerKey: string;
  targetMoments: number;
  opens: string;
  closes: string;
}

export const BLANK_DROP: DropInput = { title: "", slug: "", blurb: "", cornerKey: "", targetMoments: 1, opens: "", closes: "" };

/** "Make One, Give One" becomes "make-one-give-one": the address at /drop/…, 60 characters at most. */
export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

/** A datetime-local value for a moment, in the device's own time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const inputForDrop = (d: Drop): DropInput => ({
  title: d.title,
  slug: d.slug,
  blurb: d.blurb ?? "",
  cornerKey: d.cornerKey,
  targetMoments: d.targetMoments,
  opens: toLocalInput(d.opensAt),
  closes: toLocalInput(d.closesAt),
});

/** The first thing wrong with the form, in words for the admin, or null. The same limits the table enforces. */
export function dropProblem(input: DropInput): string | null {
  const title = input.title.trim();
  if (!title) return "Give it a title.";
  if (title.length > 60) return "Keep the title to 60 characters.";
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(input.slug)) return "The link name needs 2 to 60 lower-case letters, numbers or hyphens.";
  if (input.blurb.trim().length > 280) return "Keep the description to 280 characters.";
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(input.cornerKey)) return "Choose a Corner from the list.";
  if (!Number.isInteger(input.targetMoments) || input.targetMoments < 1 || input.targetMoments > 60) return "The goal is 1 to 60 Moments.";
  const opens = new Date(input.opens).getTime();
  const closes = new Date(input.closes).getTime();
  if (Number.isNaN(opens)) return "Choose when it opens.";
  if (Number.isNaN(closes)) return "Choose when it closes.";
  if (closes <= opens) return "It has to close after it opens.";
  return null;
}

const COLUMNS = "id, slug, title, blurb, corner_key, target_moments, opens_at, closes_at, max_editions, palette";

/** Every drop, newest window first, with its counts. Admins only: the database refuses anyone else the unopened ones. */
export async function fetchAllDrops(): Promise<{ drops: Drop[]; error: string | null }> {
  const client = supabase;
  if (!client) return { drops: [], error: LOAD_ERROR_LINE };
  try {
    const { data, error } = await client.from("drops").select(COLUMNS).order("opens_at", { ascending: false });
    if (error || !data) return { drops: [], error: LOAD_ERROR_LINE };
    const drops = await Promise.all(
      (data as Parameters<typeof dropFromRow>[0][]).map(async (row) => {
        const [people, stubs] = await Promise.all([
          client.from("pursuits").select("id", { count: "exact", head: true }).eq("drop_id", row.id),
          client.from("stubs").select("id", { count: "exact", head: true }).eq("drop_id", row.id).eq("kind", "drop"),
        ]);
        return dropFromRow({ ...row, people_in: people.error ? null : (people.count ?? 0), finished: stubs.error ? null : (stubs.count ?? 0) });
      }),
    );
    return { drops, error: null };
  } catch {
    return { drops: [], error: LOAD_ERROR_LINE };
  }
}

/** Create a drop, or change one. Resolves to an error message, or null when it saved. */
export async function saveDrop(input: DropInput, userId: string, id?: number): Promise<string | null> {
  const problem = dropProblem(input);
  if (problem) return problem;
  if (!supabase) return ERROR_LINE;
  const row = {
    title: input.title.trim(),
    slug: input.slug,
    blurb: input.blurb.trim() || null,
    corner_key: input.cornerKey,
    target_moments: input.targetMoments,
    opens_at: new Date(input.opens).toISOString(),
    closes_at: new Date(input.closes).toISOString(),
  };
  try {
    const { error } = id == null ? await supabase.from("drops").insert({ ...row, created_by: userId }) : await supabase.from("drops").update(row).eq("id", id);
    if (!error) return null;
    return error.code === "23505" ? "That link name is taken. Choose another." : ERROR_LINE;
  } catch {
    return ERROR_LINE;
  }
}
