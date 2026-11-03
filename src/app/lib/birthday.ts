import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

/**
 * A birthday after onboarding (20261111000150_birthdate_rules.sql): once set it is locked, and an
 * under-18 date drops the account to Stubby only (it is not deleted, and the date isn't stored).
 */

type Client = SupabaseClient | null;

/** set_my_birthdate()'s answers, plus "error" for anything that didn't reach it. */
export type BirthdayResult = "ok" | "under_18" | "locked" | "invalid" | "error";

/**
 * Whether this person has a birthday on file: true, false, or null when it can't be read.
 * Their own row only (RLS); the date itself is never kept on the page.
 */
export async function hasBirthdayOnFile(userId: string, client: Client = supabase): Promise<boolean | null> {
  if (!client || !userId) return null;
  try {
    const { data, error } = await client.from("profile_private").select("birthdate").eq("user_id", userId).maybeSingle();
    if (error) return null;
    return !!(data as { birthdate?: unknown } | null)?.birthdate;
  } catch {
    return null;
  }
}

/** Sets it, once. The database decides: ok, under_18, locked or invalid. */
export async function setMyBirthday(birthdate: string, client: Client = supabase): Promise<BirthdayResult> {
  if (!client) return "error";
  try {
    const { data, error } = await client.rpc("set_my_birthdate", { p_birthdate: birthdate });
    if (error) return "error";
    return data === "ok" || data === "under_18" || data === "locked" || data === "invalid" ? data : "error";
  } catch {
    return "error";
  }
}

/** Whether an account dropped to Stubby only by an under-18 birthday may open a path: the same as a Stubby account. */
export const isUnder18 = (access: string | null | undefined) => access === "under_18";
