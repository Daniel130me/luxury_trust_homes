"use client";

/** Public site frame: header + content + sticky footer. */
import { PublicHeader } from "@/components/platform/public-header";
import { PublicFooter } from "@/components/platform/public-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
