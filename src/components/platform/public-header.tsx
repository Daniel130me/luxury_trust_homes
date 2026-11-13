"use client";

/**
 * Public site header — navigation, saved shortcut and account menu,
 * matching the prototype (Buy/Rent/Sell/Explore/Help Desk).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, roleLabel, workspaceHome } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Logo, BellIcon, HeartIcon, ChevronDownIcon, LogoutIcon, UserIcon, LayoutIcon } from "./ui-bits";

const NAV_LINKS = [
  { href: "/properties?type=sale", label: "Buy" },
  { href: "/properties?type=rent", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/properties", label: "Explore" },
  { href: "/help", label: "Help Desk" },
];

export function PublicHeader() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    apiFetch<{ unread: number }>("/notifications/unread-count")
      .then((d) => setUnread(d.unread))
      .catch(() => undefined);
  }, [user, pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
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
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-50"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-ink-strong">{user.name}</span>
                    <span className="block text-xs leading-tight text-ink-muted">
                      {roleLabel(user.role, user.providerKind)}
                    </span>
                  </span>
                  <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
                  >
                    <MenuItem icon={<LayoutIcon className="h-4 w-4" />} onClick={() => { setMenuOpen(false); router.push(workspaceHome(user.role)); }}>
                      My workspace
                    </MenuItem>
                    <MenuItem icon={<UserIcon className="h-4 w-4" />} onClick={() => { setMenuOpen(false); router.push("/app/profile"); }}>
                      Account &amp; profile
                    </MenuItem>
                    <MenuItem icon={<HeartIcon className="h-4 w-4" />} onClick={() => { setMenuOpen(false); router.push("/app/saved"); }}>
                      Saved properties
                    </MenuItem>
                    <div className="my-1 border-t border-zinc-100" />
                    <MenuItem
                      icon={<LogoutIcon className="h-4 w-4" />}
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        router.push("/");
                      }}
                    >
                      Sign out
                    </MenuItem>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/app/saved"
                className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
                aria-label="Saved properties"
              >
                <HeartIcon className="h-5 w-5" />
              </Link>
              {!loading && (
                <>
                  <Link href="/login" className="px-3 py-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
                  >
                    Register
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav aria-label="Main" className="border-t border-zinc-100 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function MenuItem({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      {icon}
      {children}
    </button>
  );
}
