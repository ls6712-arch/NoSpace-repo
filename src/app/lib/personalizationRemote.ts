import { supabase } from "../../lib/supabase";
import { emptyPersonalization, parsePersonalization, type Personalization } from "./personalization";
type Client = typeof supabase;
export type PersonalizationRead = { status: "ready" | "missing"; value: Personalization; revision: number }
  | { status: "unavailable" | "invalid"; error: string };
async function owner(client: Client, expected: string) {
  if (!client) throw new Error("Your account is unavailable. Try again.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== expected || data.user.is_anonymous) throw new Error("Your account changed. Reload before saving.");
}
export async function readPersonalization(expected: string, client: Client = supabase): Promise<PersonalizationRead> {
  try {
    await owner(client, expected);
    const { data, error } = await client!.from("stubby_capabilities").select("personalization, revision").eq("user_id", expected).maybeSingle();
    if (error) return { status: "unavailable", error: "Your preferences couldn’t load. Try again." };
    if (!data) return { status: "missing", value: emptyPersonalization(), revision: 0 };
    try {
      if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error();
      return { status: "ready", value: parsePersonalization(data.personalization), revision: data.revision };
    } catch { return { status: "invalid", error: "Your saved preferences couldn’t be read. Reload before editing." }; }
  } catch(e) { return { status: "unavailable", error: e instanceof Error ? e.message : "Your preferences couldn’t load." }; }
}
/** Patch semantics distinguish Skip (no call), explicit empty/clear and an actual edit. */
export async function savePersonalization(expected: string, revision: number, changes: Partial<Omit<Personalization,"confirmedAt">>, client: Client = supabase) {
  await owner(client, expected);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Reload before saving.");
  const { data, error } = await client!.rpc("save_personalization", { expected_user: expected, expected_revision: revision, changes });
  if (error) throw new Error(error.code === "40001" ? "Your preferences changed elsewhere. Reload before saving." : "Your changes weren’t saved. Try again.");
  if (!data || !Number.isSafeInteger(data.revision)) throw new Error("Your save couldn’t be confirmed. Reload before editing.");
  return { value: parsePersonalization(data.value), revision: data.revision as number };
}
