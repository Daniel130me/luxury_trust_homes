"use client";

/**
 * Authentication context.
 *
 * Bootstraps from GET /auth/me (falling back to one silent refresh), holds
 * the signed-in user and exposes login / register / logout. Route guards
 * in the workspace layouts read this context.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiRequestError } from "./api";

export type Role = "LAWYER" | "SUPPORT" | "PROVIDER" | "CLIENT";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status?: string;
  providerKind?: "OWNER" | "DEVELOPER" | "AGENT" | null;
  clientKind?: "BUYER" | "RENTER" | "BROWSING" | null;
  interest?: string | null;
  organisation?: string | null;
  city?: string | null;
  preferredState?: string | null;
  preferredRegion?: string | null;
  alertsEnabled?: boolean;
  registeredAt?: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  refreshUser: () => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => undefined,
  refreshUser: async () => null,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const data = await apiFetch<{ user: SessionUser }>("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (err) {
      setUser(null);
      if (err instanceof ApiRequestError && err.status !== 401 && err.status !== 403) {
        // Backend unreachable — report in console, keep the UI usable.
        console.warn("Auth bootstrap failed:", err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Clearing local state regardless.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, refreshUser, signOut }),
    [user, loading, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** Staff workspace permission checks mirrored from the backend. */
const STAFF_ROLES: Role[] = ["LAWYER", "SUPPORT"];

export function isStaffRole(role: Role | undefined | null): boolean {
  return role ? STAFF_ROLES.includes(role) : false;
}

export function workspaceHome(role: Role | undefined | null): string {
  switch (role) {
    case "LAWYER":
    case "SUPPORT":
      return "/app/staff";
    case "PROVIDER":
      return "/app/provider";
    default:
      return "/app/client";
  }
}

export function roleLabel(role: Role | undefined | null, providerKind?: string | null): string {
  switch (role) {
    case "LAWYER":
      return "Lawyer / Administrator";
    case "SUPPORT":
      return "Support Staff";
    case "PROVIDER":
      return providerKind === "DEVELOPER"
        ? "Property Developer"
        : providerKind === "AGENT"
          ? "Estate Agent"
          : "Property Provider";
    case "CLIENT":
      return "Buyer / Renter";
    default:
      return "Account";
  }
}
