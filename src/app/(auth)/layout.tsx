"use client";

/** Minimal auth frame — centred card, matching the prototype's auth pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center text-xs text-ink-muted">
        <p>
          ELVICTORIA — Property with Legal Confidence ·{" "}
          <a className="hover:text-brand-700" href="/terms">Terms</a> ·{" "}
          <a className="hover:text-brand-700" href="/privacy">Privacy</a>
        </p>
      </footer>
    </div>
  );
}
