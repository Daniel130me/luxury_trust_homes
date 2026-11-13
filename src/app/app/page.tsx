"use client";

/** /app entry — route to the right workspace home by role. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, workspaceHome } from "@/lib/auth";
import { PageLoader } from "@/components/platform/ui-bits";

export default function AppIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? workspaceHome(user.role) : "/login?next=/app");
    }
  }, [user, loading, router]);

  return <PageLoader />;
}
