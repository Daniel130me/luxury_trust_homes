"use client";

/** Route-level error boundary — a friendly message instead of the root
 *  "Application error" screen when this page's data rendering fails. */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <p className="font-medium text-ink-strong">Something went wrong on this page.</p>
      <p className="mt-1 text-sm text-ink-muted">
        Please try again — if it keeps happening, note this reference: {error?.digest ?? "—"}
      </p>
      <a href="/app/client/enquiries" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
        ← Back to my enquiries
      </a>
    </div>
  );
}
