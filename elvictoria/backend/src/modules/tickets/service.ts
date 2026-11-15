import type { Ticket, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notifyMany, audit } from "../../lib/notify.js";

/**
 * Ticket lifecycle logic, kept out of the routes so it can be unit-tested
 * (same pattern as the payments service).
 *
 * Statuses follow the standard support-desk flow:
 *   OPEN → IN_PROGRESS → RESOLVED → CLOSED, with reopen back to OPEN.
 */

// Message sent to the ticket owner when staff change the status.
// `null` means the transition is silent — the first staff reply already
// moves an OPEN ticket to IN_PROGRESS and the reply itself is the news.
const STATUS_NOTICES: Record<TicketStatus, { title: string; body: string } | null> = {
  OPEN: {
    title: "reopened",
    body: "Your ticket has been reopened and our support team is looking at it again.",
  },
  IN_PROGRESS: null,
  RESOLVED: {
    title: "resolved",
    body: "Your support ticket has been resolved. If you still need help, please open a new ticket.",
  },
  CLOSED: {
    title: "closed",
    body: "Your support ticket has been closed. If you still need help, please open a new ticket.",
  },
};

/** Statuses in which the ticket owner may still reply. */
export function ticketAcceptsReplies(status: TicketStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

/**
 * Public ticket tracking: find a ticket by its reference number and the
 * email used on it. A mismatch returns null (same as "not found") so
 * references cannot be enumerated without the email.
 */
export async function trackTicket(
  reference: string,
  email: string,
): Promise<Ticket & { messages: Array<{ id: string; at: Date; fromStaff: boolean; body: string; author: { name: string } | null }> } | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { reference: reference.trim().toUpperCase() },
    include: {
      messages: { orderBy: { at: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  // Case-insensitive comparison: users type their email in any case.
  if (!ticket || ticket.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return ticket;
}

/**
 * Apply a staff status/priority change, notify the owner on the
 * transitions they care about and record the action in the audit log.
 * Returns the updated ticket, or null when the id does not exist.
 */
export async function updateTicketAsStaff(
  ticketId: string,
  patch: { status?: TicketStatus; priority?: TicketPriority },
  actorId: string,
  ip?: string,
): Promise<Ticket | null> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: patch,
  });

  const notice = patch.status ? STATUS_NOTICES[patch.status] : null;
  if (notice && ticket.userId) {
    await notifyMany([
      {
        userId: ticket.userId,
        category: "case_update",
        title: `Ticket ${ticket.reference} ${notice.title}`,
        body: notice.body,
        link: `/app/help/${ticket.id}`,
      },
    ]);
  }
  // Audit what changed so support actions are traceable.
  const changes = Object.keys(patch).map((key) => `${key}=${(patch as Record<string, string>)[key]}`);
  await audit({ actorId, action: "helpdesk.update", entityType: "Ticket", entityId: ticket.id, ip, meta: { changes } });

  return updated;
}
