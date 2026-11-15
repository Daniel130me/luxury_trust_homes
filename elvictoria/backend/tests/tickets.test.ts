/**
 * Helpdesk ticket lifecycle tests (vitest).
 *
 * Covers the standardisation work: reference formatting, public tracking
 * by reference + email, reply rules per status and staff status/priority
 * updates (including owner notifications and audit records).
 * Unit-level, no database required — prisma and notify are mocked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------- mocks

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    ticket: { findUnique: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
  },
}));

vi.mock("../src/lib/notify.js", () => ({
  notifyMany: vi.fn(),
  notifyAllLawyers: vi.fn(),
  audit: vi.fn(),
}));

import { trackTicket, ticketAcceptsReplies, updateTicketAsStaff } from "../src/modules/tickets/service.js";
import { nextReference } from "../src/lib/references.js";
import { prisma } from "../src/lib/prisma.js";
import { notifyMany, audit } from "../src/lib/notify.js";

const ticket = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  reference: "ELV-HD-0007",
  userId: "u1",
  name: "Test User",
  email: "User@Example.com",
  status: "OPEN",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------------------------ references

describe("nextReference formatting", () => {
  it("pads short counter values to 4 digits", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ value: 7 }]) };
    expect(await nextReference(tx as never, "ticket")).toBe("ELV-HD-0007");
  });

  it("leaves 4-digit and larger values unchanged", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ value: 5001 }]) };
    expect(await nextReference(tx as never, "ticket")).toBe("ELV-HD-5001");
    const big = { $queryRaw: vi.fn().mockResolvedValue([{ value: 12345 }]) };
    expect(await nextReference(big as never, "ticket")).toBe("ELV-HD-12345");
  });
});

// ---------------------------------------------------------------- track

describe("trackTicket (public lookup by reference + email)", () => {
  it("matches the email case-insensitively and returns the ticket", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket() as never);
    const result = await trackTicket("ELV-HD-0007", "user@example.com");
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("ELV-HD-0007");
  });

  it("normalises the reference to upper case", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket() as never);
    await trackTicket("elv-hd-0007", "user@example.com");
    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { reference: "ELV-HD-0007" } }));
  });

  it("returns null on email mismatch (same as not found — no enumeration)", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket() as never);
    expect(await trackTicket("ELV-HD-0007", "attacker@example.com")).toBeNull();
  });

  it("returns null for an unknown reference", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(null);
    expect(await trackTicket("ELV-HD-9999", "user@example.com")).toBeNull();
  });
});

// ---------------------------------------------------------------- reply rules

describe("ticketAcceptsReplies", () => {
  it("allows replies while open or in progress", () => {
    expect(ticketAcceptsReplies("OPEN")).toBe(true);
    expect(ticketAcceptsReplies("IN_PROGRESS")).toBe(true);
  });

  it("blocks replies once resolved or closed", () => {
    expect(ticketAcceptsReplies("RESOLVED")).toBe(false);
    expect(ticketAcceptsReplies("CLOSED")).toBe(false);
  });
});

// ------------------------------------------------------- staff updates

describe("updateTicketAsStaff", () => {
  it("returns null for an unknown ticket id", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(null);
    expect(await updateTicketAsStaff("nope", { status: "RESOLVED" }, "staff1")).toBeNull();
  });

  it("notifies the owner and audits when a ticket is resolved", async () => {
    const existing = ticket();
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prisma.ticket.update).mockResolvedValue({ ...existing, status: "RESOLVED" } as never);

    const result = await updateTicketAsStaff("t1", { status: "RESOLVED" }, "staff1", "10.0.0.1");
    expect(result).not.toBeNull();
    expect(notifyMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "u1", title: "Ticket ELV-HD-0007 resolved" }),
    ]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "helpdesk.update", meta: { changes: ["status=RESOLVED"] }, ip: "10.0.0.1" }),
    );
  });

  it("does not notify on IN_PROGRESS (the staff reply itself is the news)", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket() as never);
    vi.mocked(prisma.ticket.update).mockResolvedValue(ticket({ status: "IN_PROGRESS" }) as never);

    await updateTicketAsStaff("t1", { status: "IN_PROGRESS" }, "staff1");
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("updates priority silently and records it in the audit log", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket() as never);
    vi.mocked(prisma.ticket.update).mockResolvedValue(ticket({ priority: "URGENT" }) as never);

    await updateTicketAsStaff("t1", { priority: "URGENT" }, "staff1");
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priority: "URGENT" } }),
    );
    expect(notifyMany).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ meta: { changes: ["priority=URGENT"] } }));
  });

  it("skips the notification for anonymous tickets (no owner account)", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket({ userId: null }) as never);
    vi.mocked(prisma.ticket.update).mockResolvedValue(ticket({ userId: null, status: "CLOSED" }) as never);

    await updateTicketAsStaff("t1", { status: "CLOSED" }, "staff1");
    expect(notifyMany).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });
});
