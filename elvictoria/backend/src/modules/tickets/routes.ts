import { Router } from "express";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, phoneSchema, pageSchema, pageSizeSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { publicFormLimiter } from "../../middleware/rateLimit.js";
import { prisma } from "../../lib/prisma.js";
import { notifyMany, notifyAllLawyers, audit } from "../../lib/notify.js";
import { nextReference } from "../../lib/references.js";
import { trackTicket, ticketAcceptsReplies, updateTicketAsStaff } from "./service.js";
import type { Prisma } from "@prisma/client";
import type { TicketPriority, TicketStatus } from "@prisma/client";

/**
 * Helpdesk tickets.
 *
 * Clients create tickets (and receive a reference number), reply and track;
 * staff (helpdesk.manage) search, reply, set status/priority and close.
 * The fraud category is flagged on the staff dashboard.
 */
const router = Router();

const CATEGORIES = ["enquiries", "payments", "listings", "account", "fraud", "other"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

// Public tracking by reference number (no login required). The email on
// the ticket must match, so knowing a reference alone reveals nothing.
router.get(
  "/track",
  publicFormLimiter, // reference + email guessing must stay slow
  validate({
    query: z.object({
      reference: z.string().trim().min(6).max(24),
      email: z.string().trim().max(254).email("Enter the email address you used on the ticket."),
    }),
  }),
  async (req, res) => {
    const q = req.validated!.query as never as { reference: string; email: string };
    const ticket = await trackTicket(q.reference, q.email);
    if (!ticket) throw ApiError.notFound("No ticket found for that reference and email.");
    ok(res, { ticket });
  },
);

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      category: z.enum(CATEGORIES),
      subject: z.string().trim().min(5, "Summarise the issue.").max(160),
      body: z.string().trim().min(10, "Describe the issue in a little more detail.").max(4000),
      phone: phoneSchema,
    }),
  }),
  async (req, res) => {
    const user = req.user!;
    const ticket = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx as never, "ticket");
      return tx.ticket.create({
        data: {
          reference,
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: req.body.phone || null,
          category: req.body.category,
          subject: req.body.subject.trim(),
          messages: {
            create: { authorId: user.id, fromStaff: false, body: req.body.body.trim() },
          },
        },
      });
    });

    await notifyAllLawyers([
      {
        category: "admin_alert",
        title: "New help desk ticket",
        body: `${ticket.reference} (${req.body.category}): ${ticket.subject}`,
        link: `/app/staff/helpdesk/${ticket.id}`,
      },
    ]);
    ok(res, { ticket }, 201);
  },
);

router.get("/mine", requireAuth, async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { at: "asc" }, select: { at: true, fromStaff: true, body: true } } },
  });
  ok(res, { tickets });
});

router.get("/mine/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: String(req.params.id) },
    include: { messages: { orderBy: { at: "asc" }, include: { author: { select: { name: true } } } } },
  });
  if (!ticket || ticket.userId !== req.user!.id) throw ApiError.notFound("Ticket not found.");
  ok(res, { ticket });
});

router.post(
  "/mine/:id/reply",
  requireAuth,
  validate({ body: z.object({ body: z.string().trim().min(1).max(4000) }) }),
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id) } });
    if (!ticket || ticket.userId !== req.user!.id) throw ApiError.notFound("Ticket not found.");
    if (!ticketAcceptsReplies(ticket.status)) {
      throw ApiError.badRequest("This ticket is closed. Please open a new ticket for further questions.");
    }
    const message = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, fromStaff: false, body: req.body.body.trim() },
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    await notifyAllLawyers([
      { category: "admin_alert", title: "Ticket reply", body: `${ticket.reference}: ${req.body.body.slice(0, 90)}`, link: `/app/staff/helpdesk/${ticket.id}` },
    ]);
    ok(res, { message }, 201);
  },
);

// ---------------------------------------------------------------- staff

router.get(
  "/staff",
  requirePermission("helpdesk.manage"),
  validate({
    query: z.object({
      page: pageSchema.optional(),
      pageSize: pageSizeSchema.optional(),
      status: z.enum(STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      q: z.string().trim().max(80).optional(),
    }),
  }),
  async (req, res) => {
    const q = req.validated!.query as never as {
      page?: number;
      pageSize?: number;
      status?: TicketStatus;
      priority?: TicketPriority;
      q?: string;
    };
    // undefined filter values mean "no filter" in Prisma.
    const where: Prisma.TicketWhereInput = {
      status: q.status,
      priority: q.priority,
      ...(q.q
        ? {
            OR: [
              { reference: { contains: q.q, mode: "insensitive" } },
              { subject: { contains: q.q, mode: "insensitive" } },
              { email: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: ((q.page ?? 1) - 1) * (q.pageSize ?? 20),
        take: q.pageSize ?? 20,
        include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { at: "asc" } } },
      }),
    ]);
    ok(res, { tickets, total, page: q.page ?? 1, pageSize: q.pageSize ?? 20, pages: Math.ceil(total / (q.pageSize ?? 20)) });
  },
);

router.get("/staff/:id", requirePermission("helpdesk.manage"), async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: String(req.params.id) },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { at: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!ticket) throw ApiError.notFound("Ticket not found.");
  ok(res, { ticket });
});

router.post(
  "/staff/:id/reply",
  requirePermission("helpdesk.manage"),
  validate({ body: z.object({ body: z.string().trim().min(1).max(4000) }) }),
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id) } });
    if (!ticket) throw ApiError.notFound("Ticket not found.");
    const message = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, fromStaff: true, body: req.body.body.trim() },
    });
    // First staff response moves an OPEN ticket to IN_PROGRESS — the
    // standard helpdesk behaviour so the client sees it is being worked on.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date(), ...(ticket.status === "OPEN" ? { status: "IN_PROGRESS" as const } : {}) },
    });
    if (ticket.userId) {
      await notifyMany([
        { userId: ticket.userId, category: "case_update", title: `Reply on ${ticket.reference}`, body: req.body.body.slice(0, 140), link: `/app/help/${ticket.id}` },
      ]);
    }
    await audit({ actorId: req.user!.id, action: "helpdesk.reply", entityType: "Ticket", entityId: ticket.id, ip: req.ip });
    ok(res, { message }, 201);
  },
);

// Staff status/priority update — the standard "manage ticket" endpoint.
// Replaces the old resolve-only action; any lifecycle transition and the
// priority are set here, with owner notification and an audit record.
router.patch(
  "/staff/:id",
  requirePermission("helpdesk.manage"),
  validate({
    body: z
      .object({
        status: z.enum(STATUSES).optional(),
        priority: z.enum(PRIORITIES).optional(),
      })
      .refine((data) => data.status !== undefined || data.priority !== undefined, {
        message: "Provide a status or a priority to update.",
      }),
  }),
  async (req, res) => {
    const body = req.validated!.body as never as { status?: TicketStatus; priority?: TicketPriority };
    const ticket = await updateTicketAsStaff(String(req.params.id), body, req.user!.id, req.ip);
    if (!ticket) throw ApiError.notFound("Ticket not found.");
    ok(res, { ticket });
  },
);

export default router;
