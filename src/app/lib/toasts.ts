import { TOAST_MS } from "./motionTokens";

/**
 * The toast queue behind <Toaster> (components/ui/toaster.tsx). Call
 * `showToast` from anywhere; the Toaster mounted once in App renders it.
 * Same call shape as the library it replaced, so `showToast(message, { duration, action })`.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Milliseconds until it closes itself, shown as the fuse. Defaults to TOAST_MS. */
  duration?: number;
  action?: ToastAction;
  tone?: "error";
}

export interface ToastItem extends Required<Pick<ToastOptions, "duration">> {
  id: number;
  message: string;
  action?: ToastAction;
  tone?: "error";
  /** False once a newer toast has pushed it out; it then leaves on its own. */
  open: boolean;
}

/** Two at a time, as before: a third closes the oldest. */
export const MAX_TOASTS = 2;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, options: ToastOptions = {}): number {
  const id = nextId++;
  const toast: ToastItem = { id, message, duration: options.duration ?? TOAST_MS, action: options.action, tone: options.tone, open: true };
  const next = [...items, toast];
  const open = next.filter((t) => t.open);
  const excess = open.length - MAX_TOASTS;
  items = excess > 0 ? next.map((t) => (open.slice(0, excess).includes(t) ? { ...t, open: false } : t)) : next;
  emit();
  return id;
}

/** Closes a toast; it plays its exit, then `removeToast` drops it. */
export function dismissToast(id: number): void {
  if (!items.some((t) => t.id === id && t.open)) return;
  items = items.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
}

/** Called by the Toaster once a toast has finished leaving. */
export function removeToast(id: number): void {
  if (!items.some((t) => t.id === id)) return;
  items = items.filter((t) => t.id !== id);
  emit();
}

export function getToasts(): readonly ToastItem[] {
  return items;
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only. */
export function resetToasts(): void {
  items = [];
  emit();
}
