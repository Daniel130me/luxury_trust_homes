"use client";

/**
 * Minimal global toast store.
 *
 * Action feedback must be visible where the user is looking — not in an
 * alert at the top of the page they may have to scroll to. Any component
 * can push a toast; the single <Toaster /> mounted in the workspace shell
 * renders them. No context provider needed: a module-level store keeps
 * this usable from plain event handlers.
 */

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type Listener = (toasts: Toast[]) => void;

// How long each kind stays on screen. Errors linger — they need reading.
const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  error: 7000,
};

const MAX_VISIBLE = 4;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function notify() {
  const snapshot = [...toasts];
  for (const listener of listeners) listener(snapshot);
}

function push(kind: ToastKind, message: string) {
  // Collapse identical consecutive messages (e.g. double-click retries)
  // so a user doesn't get a wall of the same error.
  const last = toasts[toasts.length - 1];
  if (last && last.kind === kind && last.message === message) return;

  const id = nextId++;
  toasts = [...toasts, { id, kind, message }].slice(-MAX_VISIBLE);
  notify();
  const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS[kind]);
  timers.set(id, timer);
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  if (toasts.some((t) => t.id === id)) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

/** Subscribe from React (useEffect). Returns the unsubscribe function. */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}
