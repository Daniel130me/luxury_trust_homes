"use client";

/** Minimal auth frame — the auth pages render their own full-screen
 *  split layout (AuthShell), so no chrome is added here. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper">{children}</div>;
}
