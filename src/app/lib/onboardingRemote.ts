import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { isStep, type OnboardingStep } from "../pages/onboarding/steps";

/**
 * What the onboarding screens write: the last finished step, birthdate, area
 * and city (profile_private, owner-only) and the username (a database function
 * that only works until onboarding is finished). All of it comes from migration
 * 20261104000000. Before that migration is live each call quietly does nothing,
 * so the screens still work and nobody is blocked by a missing column.
 */
// PostgREST: PGRST202 no such function, PGRST204 no such column; Postgres: 42883 no such function, 42703 no such column.
const notDeployed = (code?: string) => code === "PGRST202" || code === "PGRST204" || code === "42883" || code === "42703";

export async function fetchRemoteStep(userId: string): Promise<OnboardingStep | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("profile_private").select("onboarding_step").eq("user_id", userId).maybeSingle();
    if (error) return null;
    const value = (data as { onboarding_step: string | null } | null)?.onboarding_step;
    return isStep(value) ? value : null;
  } catch {
    return null;
  }
}

export interface PrivateFields {
  birthdate?: string;
  city?: string | null;
  area?: string | null;
  onboarding_step?: OnboardingStep;
}

/** The message the database raises when a birthdate is younger than the minimum age. */
export const UNDER_AGE_MESSAGE = "under_minimum_age";

export async function savePrivate(userId: string, fields: PrivateFields): Promise<{ error: string | null; underAge?: boolean }> {
  if (!supabase) return { error: null };
  try {
    const { error } = await supabase
      .from("profile_private")
      .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (!error) return { error: null };
    if (error.message === UNDER_AGE_MESSAGE) return { error: null, underAge: true };
    if (notDeployed(error.code)) return { error: null };
    return { error: friendlyError(error) };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}

/** Saving the step never blocks anyone: a failure only means resume starts a screen earlier. */
export async function saveRemoteStep(userId: string, step: OnboardingStep): Promise<void> {
  await savePrivate(userId, { onboarding_step: step });
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** A username to start from: the first name, lowercase, letters, numbers and underscores. Empty when too short. */
export function usernameFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, USERNAME_MAX);
  return base.length >= USERNAME_MIN ? base : "";
}

export const isValidUsername = (u: string) => /^[a-z0-9_]{3,20}$/.test(u);

/** A first name for the greeting: the first word of what was typed. */
export function firstNameOf(typed: string): string {
  return typed.replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
}

export type UsernameResult = "ok" | "taken" | "invalid" | "skipped" | "error";

export async function setUsername(username: string): Promise<UsernameResult> {
  if (!supabase) return "skipped";
  try {
    const { data, error } = await supabase.rpc("set_username_during_onboarding", { p_username: username });
    if (error) return notDeployed(error.code) ? "skipped" : "error";
    return data === "ok" || data === "taken" || data === "invalid" ? data : "error";
  } catch {
    return "error";
  }
}

/** The first free username near the one typed, or null when it cannot be checked. */
export async function suggestUsername(username: string): Promise<string | null> {
  if (!supabase || !username) return null;
  try {
    const { data, error } = await supabase.rpc("username_suggestion", { p_username: username });
    return !error && typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

/**
 * An under-18 sign-up: the database marks the account for the nightly purge
 * with no grace period (migration 20261104000000). Quietly does nothing before
 * that migration is live; the caller signs out either way.
 */
export async function removeUnderageAccount(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("remove_underage_account");
  } catch {
    // Signing out still happens.
  }
}
