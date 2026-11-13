"use client";

/** All /app/* routes share the workspace shell (sidebar + role guards). */
import { WorkspaceShell } from "@/components/platform/workspace-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
