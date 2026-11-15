/**
 * Shared helpdesk vocabulary — status/priority labels and badge styles —
 * so every page that shows a ticket renders it the same way.
 */

export type TicketStatusKey = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriorityKey = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const STATUS_BADGES: Record<TicketStatusKey, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "bg-brand-50 text-brand-700" },
  IN_PROGRESS: { label: "In progress", tone: "bg-amber-50 text-amber-700" },
  RESOLVED: { label: "Resolved", tone: "bg-emerald-50 text-emerald-700" },
  CLOSED: { label: "Closed", tone: "bg-neutral-100 text-neutral-600" },
};

export const PRIORITY_BADGES: Record<TicketPriorityKey, { label: string; tone: string }> = {
  LOW: { label: "Low priority", tone: "bg-neutral-100 text-neutral-600" },
  MEDIUM: { label: "Medium priority", tone: "bg-brand-50 text-brand-700" },
  HIGH: { label: "High priority", tone: "bg-amber-50 text-amber-700" },
  URGENT: { label: "Urgent", tone: "bg-red-50 text-red-700" },
};

/** Badge styles for an unknown status value (defensive for older data). */
export const statusBadge = (status: string) =>
  STATUS_BADGES[status as TicketStatusKey] ?? { label: status, tone: "bg-brand-50 text-brand-700" };

export const priorityBadge = (priority: string) =>
  PRIORITY_BADGES[priority as TicketPriorityKey] ?? { label: priority, tone: "bg-brand-50 text-brand-700" };

/** Statuses in which the client can still reply (mirrors backend rule). */
export const ticketAcceptsReplies = (status: string) => status === "OPEN" || status === "IN_PROGRESS";
