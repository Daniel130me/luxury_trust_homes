"use client";

/**
 * Workspace shell — the sidebar layout used by client, provider and staff
 * dashboards. Structure, classes and footnote copy are lifted from the
 * prototype: solid brand-900 sidebar (w-64, fixed, off-canvas on mobile),
 * blurred white topbar with gold-accented account chip, and a centered
 * max-w-7xl content column.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, isStaffRole, roleLabel, workspaceHome } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  Logo, BellIcon, LogoutIcon, BuildingIcon,
  EnvelopeIcon, CreditCardIcon, UsersIcon, FileIcon, ScaleIcon, HelpCircleIcon,
  SettingsIcon, HeartIcon, UserIcon, MenuIcon,
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
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
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

  const navList = (
    <nav aria-label="Workspace" className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active =
          item.href === pathname ||
          (item.href !== "/app/staff" &&
            item.href !== "/app/client" &&
            item.href !== "/app/provider" &&
            pathname.startsWith(item.href));
        // Item classes straight from the prototype sidebar.
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-brand-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-gold-400 px-1.5 text-2xs font-semibold text-brand-950">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <>
      <div className="mb-8 px-2">
        <Logo light />
      </div>
      {navList}
      <div className="mt-auto rounded-lg bg-white/5 px-3 py-3 text-xs text-brand-300">{footnote}</div>
    </>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar — fixed rail on desktop, off-canvas drawer on mobile. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-brand-900 px-4 py-5 lg:flex">
        {sidebarBody}
      </aside>
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-brand-950/50 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-brand-900 px-4 py-5 lg:hidden">
            {sidebarBody}
          </aside>
        </>
      )}

      {/* Main column */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-brand-100/70 bg-white/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg p-2 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5 text-ink-soft" />
          </button>
          <div className="lg:hidden">
            <Logo href={workspaceHome(user.role)} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/app/notifications"
            className="relative rounded-lg p-2 text-ink-soft hover:bg-brand-50"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <BellIcon className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-2xs font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-brand-50"
            aria-label="Account — sign out"
          >
            <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-ink-strong">{user.name}</span>
              <span className="block text-xs leading-tight text-ink-muted">{roleLabel(user.role, user.providerKind)}</span>
            </span>
          </button>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="rounded-lg p-2 text-ink-soft hover:bg-brand-50"
            aria-label="Sign out"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function iconFor(href: string): React.ReactNode {
  if (href.includes("listing") || href.includes("propert")) return <BuildingIcon className="h-4 w-4" />;
  if (href.includes("enquir") || href.includes("matter") || href.includes("case")) return <EnvelopeIcon className="h-4 w-4" />;
  if (href.includes("payment")) return <CreditCardIcon className="h-4 w-4" />;
  if (href.includes("user")) return <UsersIcon className="h-4 w-4" />;
  if (href.includes("report")) return <FileIcon className="h-4 w-4" />;
  if (href.includes("helpdesk") || href.includes("/help")) return <HelpCircleIcon className="h-4 w-4" />;
  if (href.includes("settings")) return <SettingsIcon className="h-4 w-4" />;
  if (href.includes("saved")) return <HeartIcon className="h-4 w-4" />;
  if (href.includes("profile")) return <UserIcon className="h-4 w-4" />;
  if (href.includes("notification")) return <BellIcon className="h-4 w-4" />;
  return <ScaleIcon className="h-4 w-4" />;
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
      { href: "/app/provider", label: "Overview", icon: iconFor("/app/provider") },
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
