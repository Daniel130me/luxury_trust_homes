"use client";

/**
 * Public site header — navigation, saved shortcut and account menu.
 * Classes lifted from the prototype header: blurred white bar on
 * brand-100/70 hairline, container-page gutters, ink nav links,
 * ghost Login + wine Register buttons.
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
    <header className="sticky top-0 z-30 border-b border-brand-100/70 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-base font-medium transition text-ink-soft hover:text-ink-strong"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
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
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-brand-50"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-tight text-ink-strong">{user.name}</span>
                    <span className="block text-2xs leading-tight text-ink-muted">
                      {roleLabel(user.role, user.providerKind)}
                    </span>
                  </span>
                  <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="animate-fade absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-lg border border-brand-100 bg-white shadow-lift"
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
                    <div className="my-1 border-t border-brand-50" />
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
                className="hidden rounded-lg p-2 text-ink-soft hover:bg-brand-50 md:block"
                aria-label="Saved properties"
                title="Saved properties"
              >
                <HeartIcon className="h-5 w-5" />
              </Link>
              <div className="hidden items-center gap-2 md:flex">
                {!loading && (
                  <>
                    {/* Ghost and primary buttons — prototype header pair. */}
                    <Link
                      href="/login"
                      className="inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition text-brand-700 hover:bg-brand-50 h-10 px-4 text-sm gap-2"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-10 px-4 text-sm gap-2"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
              <button
                className="rounded-lg p-2 md:hidden"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 5h16M4 12h16M4 19h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav — anonymous visitors only; signed-in users have the
          workspace shell with its own drawer. */}
      {!user && menuOpen && (
        <nav aria-label="Main" className="border-t border-brand-50 bg-white md:hidden">
          <div className="container-page flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-ink-strong"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-brand-50 pt-3">
              <Link
                href="/login"
                className="inline-flex flex-1 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition text-brand-700 hover:bg-brand-50 h-10 px-4 text-sm gap-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex flex-1 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-10 px-4 text-sm gap-2"
              >
                Register
              </Link>
            </div>
          </div>
        </nav>
      )}
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
