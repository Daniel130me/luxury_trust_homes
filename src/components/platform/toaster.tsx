"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type Toast, type ToastKind } from "@/lib/toast";

/**
 * Renders the global toast stack: fixed to the bottom on phones (thumb
 * reach, never under the sidebar) and bottom-right on larger screens, so
 * action feedback is visible no matter where the page is scrolled.
 */

const KIND_STYLES: Record<ToastKind, { box: string; icon: string }> = {
  success: { box: "bg-emerald-800 text-white", icon: "M5 13l4 4L19 7" },
  error: { box: "bg-red-800 text-white", icon: "M6 18L18 6M6 6l12 12" },
  info: { box: "bg-brand-900 text-white", icon: "M12 8v5m0 3v.5" },
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end"
    >
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          style={{ animation: "toast-in 160ms ease-out" }}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-3.5 py-2.5 shadow-lg shadow-brand-950/20 ${KIND_STYLES[t.kind].box}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
            <path d={KIND_STYLES[t.kind].icon} />
          </svg>
          <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="-mr-1 rounded p-1 opacity-70 transition hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
