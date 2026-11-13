import type { Role } from "@prisma/client";

/**
 * Permission model copied exactly from the reviewed prototype:
 * lawyers are the platform administrators; support staff get read/observe
 * rights plus the helpdesk; providers and clients have role-scoped access
 * (ownership checks happen in the services, not here).
 */
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  LAWYER: [
    "workspace.staff",
    "listing.moderate",
    "listing.viewAll",
    "case.viewAll",
    "case.manage",
    "case.observe",
    "contact.disclose",
    "user.viewAll",
    "user.manage",
    "payment.manage",
    "reports.view",
    "settings.manage",
    "helpdesk.manage",
  ],
  SUPPORT: [
    "workspace.staff",
    "listing.viewAll",
    "case.viewAll",
    "case.observe",
    "user.viewAll",
    "helpdesk.manage",
  ],
  PROVIDER: [],
  CLIENT: [],
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DEACTIVATED";
  providerKind: string | null;
  organisation: string | null;
};

/** Check a permission for a user. Deactivated users have no permissions. */
export function can(user: AuthUser | null, permission: string): boolean {
  if (!user || user.status !== "ACTIVE") return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/** Staff workspace members = lawyer + support (permission: workspace.staff). */
export function isStaff(user: AuthUser | null): boolean {
  return can(user, "workspace.staff");
}

export const PERMISSIONS = ROLE_PERMISSIONS;
