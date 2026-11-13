"use client";

/**
 * Workspace shell — the sidebar layout used by client, provider and staff
 * dashboards. Nav items and footnotes come from the prototype; badges show
 * live unread/pending counts where relevant.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, isStaffRole, roleLabel, workspaceHome } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  Logo, BellIcon, ChevronLeftIcon, LogoutIcon, LayoutIcon, BuildingIcon,
  EnvelopeIcon, CreditCardIcon, UsersIcon, FileIcon, ScaleIcon, HelpCircleIcon,
  SettingsIcon, HeartIcon, UserIcon,
} from "./ui-bits";
import { PageLoader } from "./ui-bits";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

export function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ unread: number }>("/notifications/unread-count")
      .then((d) => setUnread(d.unread))
      .catch(() => undefined);
  }, [user, pathname]);

  if (loading) return <PageLoader label="Loading your workspace…" />;

  if (!user) {
    // Not signed in — the login screen records where to return to.
    router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
    return <PageLoader label="Redirecting to sign in…" />;
  }

  // Workspace route/role guard: staff pages need staff roles; client pages
  // need the client role (provider pages the provider role). The backend
  // enforces the same rules — this guard only avoids dead-end screens.
  const staff = isStaffRole(user.role);
  const isClientArea = pathname.startsWith("/app/client") || pathname === "/app/saved";
  const isProviderArea = pathname.startsWith("/app/provider");
  const isStaffArea = pathname.startsWith("/app/staff");

  if ((isStaffArea && !staff) || (isClientArea && user.role !== "CLIENT") || (isProviderArea && user.role !== "PROVIDER")) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-medium text-ink-strong">Access restricted</p>
        <p className="text-sm text-ink-muted">Your account does not have access to this page.</p>
        <Link
          href={workspaceHome(user.role)}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Go to my dashboard
        </Link>
      </div>
    );
  }

  const nav = buildNav(user.role as string, { unread });

  const footnote = staff
    ? "Internal notes and participant contact details are visible to ELVICTORIA staff only."
    : "All communication about a property is handled by the ELVICTORIA legal team.";

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-gradient-to-b from-brand-800 to-brand-900 text-white transition-transform lg:static lg:translate-x-0 scroll-slim ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Logo light />
          <button
            className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Workspace" className="px-3 pb-4">
          {nav.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== "/app/staff" &&
                item.href !== "/app/client" &&
                item.href !== "/app/provider" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-gold-200">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="mx-3 rounded-lg bg-white/10 p-3 text-xs leading-relaxed text-white/70">{footnote}</p>
      </aside>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-zinc-200/70 bg-white px-4 sm:px-6">
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-brand-50 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex-1" />
          <Link
            href="/app/notifications"
            className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <BellIcon className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-ink-strong">{user.name}</span>
              <span className="block text-xs leading-tight text-ink-muted">{roleLabel(user.role, user.providerKind)}</span>
            </span>
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
              aria-label="Sign out"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function iconFor(href: string): React.ReactNode {
  if (href.includes("listing") || href.includes("propert")) return <BuildingIcon className="h-4.5 w-4.5" />;
  if (href.includes("enquir") || href.includes("matter") || href.includes("case")) return <EnvelopeIcon className="h-4.5 w-4.5" />;
  if (href.includes("payment")) return <CreditCardIcon className="h-4.5 w-4.5" />;
  if (href.includes("user")) return <UsersIcon className="h-4.5 w-4.5" />;
  if (href.includes("report")) return <FileIcon className="h-4.5 w-4.5" />;
  if (href.includes("helpdesk") || href.includes("/help")) return <HelpCircleIcon className="h-4.5 w-4.5" />;
  if (href.includes("settings")) return <SettingsIcon className="h-4.5 w-4.5" />;
  if (href.includes("saved")) return <HeartIcon className="h-4.5 w-4.5" />;
  if (href.includes("profile")) return <UserIcon className="h-4.5 w-4.5" />;
  if (href.includes("notification")) return <BellIcon className="h-4.5 w-4.5" />;
  return <ScaleIcon className="h-4.5 w-4.5" />;
}

function buildNav(role: string, opts: { unread: number }): NavItem[] {
  const items: NavItem[] = [];

  if (role === "LAWYER" || role === "SUPPORT") {
    items.push(
      { href: "/app/staff", label: "Dashboard", icon: iconFor("/app/staff") },
      { href: "/app/staff/listings", label: "Listings", icon: iconFor("listings") },
      { href: "/app/staff/enquiries", label: "Enquiries", icon: iconFor("enquiries") },
      { href: "/app/staff/cases", label: "Cases", icon: iconFor("cases") },
      { href: "/app/staff/payments", label: "Payments", icon: iconFor("payments") },
      { href: "/app/staff/users", label: "Users", icon: iconFor("users") },
      { href: "/app/staff/reports", label: "Reports", icon: iconFor("reports") },
      { href: "/app/staff/helpdesk", label: "Help Desk", icon: iconFor("helpdesk") },
      { href: "/app/notifications", label: "Notifications", icon: iconFor("notifications"), badge: opts.unread || undefined },
      { href: "/app/staff/settings", label: "Settings", icon: iconFor("settings") },
    );
  } else if (role === "PROVIDER") {
    items.push(
      { href: "/app/provider", label: "Dashboard", icon: iconFor("/app/provider") },
      { href: "/app/provider/properties", label: "My Properties", icon: iconFor("propert") },
      { href: "/app/provider/properties/new", label: "Add Property", icon: iconFor("add") },
      { href: "/app/provider/cases", label: "Enquiries & Cases", icon: iconFor("cases") },
      { href: "/app/notifications", label: "Notifications", icon: iconFor("notifications"), badge: opts.unread || undefined },
      { href: "/app/help", label: "Help Desk", icon: iconFor("/help") },
    );
  } else {
    items.push(
      { href: "/app/client", label: "Dashboard", icon: iconFor("/app/client") },
      { href: "/app/client/enquiries", label: "My Enquiries", icon: iconFor("enquiries") },
      { href: "/app/client/payments", label: "Payments", icon: iconFor("payments") },
      { href: "/app/saved", label: "Saved Properties", icon: iconFor("saved") },
      { href: "/properties", label: "Explore Properties", icon: iconFor("explore") },
      { href: "/app/notifications", label: "Notifications", icon: iconFor("notifications"), badge: opts.unread || undefined },
      { href: "/app/help", label: "Help Desk", icon: iconFor("/help") },
    );
  }
  return items;
}
