import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { UPLOAD_COPY } from "./stateCopy";
import { prepareForUpload } from "./uploadMedia";

/**
 * Corner chat (Corner walls PR 3, brief of Nov 8, 2026): one chat per Corner, members only.
 * The table, its rules and the private corner-chat bucket are in
 * supabase/migrations/20261124000000_corner_chat.sql. Nothing here shows a count of people or messages.
 */

/** Approved by the founder, Nov 8, 2026. Anything else a person reads here reuses an existing string. */
export const CHAT_COPY = {
  tab: "Chat",
  placeholder: "Message the Corner",
  empty: "Say hi to the Corner.",
} as const;

export type CornerTab = "walls" | "chat" | "first";

/** The tabs of a Corner page. Chat is for approved members: signed-out and not-yet-approved visitors never get it. */
export function cornerTabs(restricted: boolean): CornerTab[] {
  return restricted ? ["walls", "first"] : ["walls", "chat", "first"];
}

/** The tab to show: "auto" until chosen (Walls for members, Your first time for visitors). A remembered Chat never shows to a visitor. */
export function resolveTab(chosen: CornerTab | "auto", restricted: boolean): CornerTab {
  if (chosen === "auto" || !cornerTabs(restricted).includes(chosen)) return restricted ? "first" : "walls";
  return chosen;
}

export const CHAT_BUCKET = "corner-chat";
/** Last messages loaded first, then this many more on each scroll to the top. */
export const CHAT_PAGE = 50;
export const MAX_BODY = 500;
export const MAX_PHOTOS = 4;
/** Before compression. The upload step then redraws each photo as a JPEG, so what is stored is much smaller. */
export const MAX_PHOTO_MB = 10;
export const CHAT_URL_TTL_SECONDS = 60 * 60;

export interface ChatMessage {
  id: number;
  userId: string;
  body: string;
  mediaPaths: string[];
  /** ms */
  createdAt: number;
  /** Set once removed. The row has no text and no photos by then, and the page draws nothing for it. */
  removed: boolean;
}

interface ChatRow {
  id: number;
  user_id: string;
  body: string;
  media_paths: string[] | null;
  created_at: string;
  removed_at: string | null;
}

const COLUMNS = "id, user_id, body, media_paths, created_at, removed_at";

export function rowToMessage(r: ChatRow): ChatMessage {
  return {
    id: Number(r.id),
    userId: r.user_id,
    body: r.body ?? "",
    mediaPaths: r.media_paths ?? [],
    createdAt: Date.parse(r.created_at),
    removed: r.removed_at != null,
  };
}

/** The folder spelling the database uses for a Corner key (storage keys do not take a colon safely). */
export function chatFolder(cornerKey: string): string {
  return cornerKey.replace(/:/g, "_");
}

/** First word of a display name, cut to a sensible length. Presence and typing show first names only. */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 30);
}

/**
 * "{A}, {B} and {C} are here now" from the first names of the people here besides you. Up to 3 names,
 * then "and others". Nothing when you are alone. Never a number.
 */
export function presenceLine(names: readonly string[]): string | null {
  const list = names.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return `${list[0]} is here now`;
  if (list.length === 2) return `${list[0]} and ${list[1]} are here now`;
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]} are here now`;
  return `${list[0]}, ${list[1]} and others are here now`;
}

export interface Run {
  userId: string;
  messages: ChatMessage[];
}
export interface DayGroup {
  /** Local calendar day, "2026-11-09". */
  day: string;
  /** Start of that day's first message, ms. Format it with dates.ts. */
  at: number;
  runs: Run[];
}

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Oldest first, grouped by day, then into runs of one sender in a row. Removed messages are left out. */
export function groupMessages(messages: readonly ChatMessage[]): DayGroup[] {
  const live = messages.filter((m) => !m.removed).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  const days: DayGroup[] = [];
  for (const m of live) {
    const key = dayKey(m.createdAt);
    let day = days[days.length - 1];
    if (!day || day.day !== key) {
      day = { day: key, at: m.createdAt, runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    if (run && run.userId === m.userId) run.messages.push(m);
    else day.runs.push({ userId: m.userId, messages: [m] });
  }
  return days;
}

/** Adds or replaces a message by id, newest last. A removed message stays in the list, so a late copy cannot bring it back. */
export function mergeMessages(list: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) {
    const have = byId.get(m.id);
    byId.set(m.id, have?.removed ? have : m);
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
}

export async function fetchChatPage(cornerKey: string, before?: { createdAt: number; id: number }): Promise<ChatMessage[]> {
  if (!supabase) return [];
  let q = supabase
    .from("corner_messages")
    .select(COLUMNS)
    .eq("corner_key", cornerKey)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_PAGE);
  if (before) q = q.lte("created_at", new Date(before.createdAt).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  const rows = ((data ?? []) as ChatRow[]).map(rowToMessage);
  // The cut at created_at is inclusive, so drop what the page already has by id order.
  return before ? rows.filter((m) => m.createdAt < before.createdAt || (m.createdAt === before.createdAt && m.id < before.id)) : rows;
}

export async function sendChatMessage(
  cornerKey: string,
  body: string,
  mediaPaths: string[],
): Promise<{ message: ChatMessage | null; error: string | null }> {
  if (!supabase) return { message: null, error: friendlyError(null) };
  const { data, error } = await supabase
    .from("corner_messages")
    .insert({ corner_key: cornerKey, body: body.trim(), media_paths: mediaPaths })
    .select(COLUMNS)
    .single();
  if (error || !data) return { message: null, error: friendlyError(error) };
  return { message: rowToMessage(data as ChatRow), error: null };
}

export async function removeChatMessage(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: friendlyError(null) };
  const { error } = await supabase.rpc("remove_corner_message", { p_id: id });
  return { error: error ? friendlyError(error) : null };
}

/**
 * The same photo pipeline as a Moment (prepareForUpload): HEIC converted, the picture redrawn on a canvas
 * at most 2048 px on its long side, the right way up, saved as a JPEG. The redraw is what drops EXIF and
 * location data; GIFs and videos, which would keep theirs, are refused. Uploaded to
 * <corner folder>/<user_id>/<uuid>.jpg in the private corner-chat bucket.
 */
export async function uploadChatPhoto(
  cornerKey: string,
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  if (!supabase) return { path: null, error: friendlyError(null) };
  const prepared = await prepareForUpload(file, { allowVideo: false, allowGif: false, maxMb: MAX_PHOTO_MB });
  if (prepared.error !== null) return { path: null, error: prepared.error };
  const path = `${chatFolder(cornerKey)}/${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, prepared.file, { contentType: "image/jpeg", upsert: false });
  if (error) return { path: null, error: friendlyError(error, UPLOAD_COPY.failed) };
  return { path, error: null };
}

/** Best effort: a failed cleanup only leaves an object nobody points at. */
export async function deleteChatPhotos(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return;
  await supabase.storage.from(CHAT_BUCKET).remove(paths);
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

/** Signed URLs for photos, one call for the batch, cached until 80% of their life has passed. A path the
 * viewer cannot read is simply missing from the result. */
export async function signChatPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0 || !supabase) return out;
  const now = Date.now();
  const toSign: string[] = [];
  for (const p of unique) {
    const hit = urlCache.get(p);
    if (hit && now < hit.expiresAt) out.set(p, hit.url);
    else toSign.push(p);
  }
  if (toSign.length === 0) return out;
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrls(toSign, CHAT_URL_TTL_SECONDS);
  if (error || !data) return out;
  const expiresAt = now + CHAT_URL_TTL_SECONDS * 1000 * 0.8;
  for (const row of data) {
    if (row.signedUrl && row.path) {
      urlCache.set(row.path, { url: row.signedUrl, expiresAt });
      out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

export interface Author {
  name: string;
  avatarUrl?: string;
}

export async function fetchAuthors(ids: string[]): Promise<Map<string, Author>> {
  const out = new Map<string, Author>();
  const unique = [...new Set(ids)];
  if (unique.length === 0 || !supabase) return out;
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", unique);
  for (const r of (data ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]) {
    out.set(r.id, { name: r.display_name ?? "", avatarUrl: r.avatar_url ?? undefined });
  }
  return out;
}

/** What an admin sees beside a reported Corner chat message: the live message, or the copy kept 30 days after its removal. */
export interface AdminChatMessage {
  body: string;
  mediaPaths: string[];
  removed: boolean;
}

/** Admins only (public.admin_corner_message). Null once a removed message's copy is past 30 days, or for anyone else. */
export async function fetchAdminChatMessage(id: number): Promise<AdminChatMessage | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("admin_corner_message", { p_id: id });
  if (error) return null;
  const row = ((data ?? []) as { body: string; media_paths: string[] | null; removed: boolean }[])[0];
  return row ? { body: row.body, mediaPaths: row.media_paths ?? [], removed: row.removed } : null;
}
