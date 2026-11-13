import { Router } from "express";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, phoneSchema, pageSchema, pageSizeSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { notifyMany, notifyAllLawyers, audit } from "../../lib/notify.js";
import { nextReference } from "../../lib/references.js";

/**
 * Helpdesk tickets.
 *
 * Clients create tickets and reply; staff (helpdesk.manage) view, reply and
 * resolve. The fraud category is flagged on the staff dashboard.
 */
const router = Router();

const CATEGORIES = ["enquiries", "payments", "listings", "account", "fraud", "other"] as const;

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
    if (ticket.status === "RESOLVED") {
      throw ApiError.badRequest("This ticket is resolved. Please open a new ticket for further questions.");
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
  validate({ query: z.object({ page: pageSchema.optional(), pageSize: pageSizeSchema.optional(), status: z.string().trim().max(12).optional() }) }),
  async (req, res) => {
    const q = req.validated!.query as never as { page?: number; pageSize?: number; status?: string };
    const where: { status?: "OPEN" | "RESOLVED" } =
      q.status === "OPEN" || q.status === "RESOLVED" ? { status: q.status } : {};
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
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    await notifyMany([
      { userId: ticket.userId, category: "case_update", title: `Reply on ${ticket.reference}`, body: req.body.body.slice(0, 140), link: `/app/help/${ticket.id}` },
    ]);
    await audit({ actorId: req.user!.id, action: "helpdesk.reply", entityType: "Ticket", entityId: ticket.id, ip: req.ip });
    ok(res, { message }, 201);
  },
);

router.post(
  "/staff/:id/resolve",
  requirePermission("helpdesk.manage"),
  async (req, res) => {
    const ticket = await prisma.ticket.update({
      where: { id: String(req.params.id) },
      data: { status: "RESOLVED" },
    });
    await notifyMany([
      { userId: ticket.userId, category: "case_update", title: `Ticket ${ticket.reference} resolved`, body: "Your support ticket has been resolved. If you still need help, please open a new ticket.", link: `/app/help/${ticket.id}` },
    ]);
    await audit({ actorId: req.user!.id, action: "helpdesk.resolve", entityType: "Ticket", entityId: ticket.id, ip: req.ip });
    ok(res, { ticket });
  },
);

export default router;
