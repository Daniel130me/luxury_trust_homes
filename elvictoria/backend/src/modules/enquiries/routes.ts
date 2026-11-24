import { Router } from "express";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, pageSchema, pageSizeSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { notifyMany, audit } from "../../lib/notify.js";
import * as svc from "./service.js";

/**
 * Enquiry + case routes.
 *
 * The prototype keys staff "matters" pages on the enquiry id (the enquiry
 * exists from the start; the case opens later), so staff detail endpoints
 * take an enquiry id while shared case endpoints (threads, timeline,
 * payments) take the case id.
 */
const router = Router();

// ------------------------------------------------------- client actions

router.post(
  "/enquiries",
  requireAuth,
  validate({
    body: z.object({
      propertyId: z.string().min(1),
      purpose: z.enum(["PURCHASE", "RENT", "INSPECTION", "MORE_INFORMATION"]),
      contactMethod: z.enum(["PHONE", "EMAIL", "PLATFORM"]),
      message: z.string().trim().min(20, "Tell the legal team a little more (at least 20 characters).").max(4000),
    }),
  }),
  async (req, res) => {
    if (req.user!.role !== "CLIENT") {
      throw ApiError.forbidden("Enquiries are submitted by buyer and renter accounts.");
    }
    ok(res, { enquiry: await svc.createEnquiry(req.user!, req.body, req.ip) }, 201);
  },
);

router.get("/enquiries/mine", requireAuth, async (req, res) => {
  if (req.user!.role !== "CLIENT") throw ApiError.forbidden();
  ok(res, { enquiries: await svc.listForClient(req.user!.id) });
});

router.get("/enquiries/:id", requireAuth, async (req, res) => {
  if (req.user!.role !== "CLIENT") throw ApiError.forbidden();
  ok(res, { enquiry: await svc.getForClient(req.user!.id, String(req.params.id)) });
});

// --------------------------------------------------------- staff actions

router.get(
  "/staff/enquiries",
  requirePermission("case.viewAll"),
  validate({
    query: z.object({
      page: pageSchema.optional(),
      pageSize: pageSizeSchema.optional(),
      view: z.enum(["all", "attention", "unassigned", "escalated"]).optional(),
      status: z.string().trim().max(30).optional(),
      search: z.string().trim().max(80).optional(),
    }),
  }),
  async (req, res) => {
    const q = req.validated!.query as never as {
      page?: number; pageSize?: number; view?: string; status?: string; search?: string;
    };
    ok(res, await svc.listForStaff(req.user!, {
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      view: q.view,
      status: q.status || undefined,
      search: q.search || undefined,
    }));
  },
);

router.get("/staff/matters", requirePermission("case.viewAll"), async (req, res) => {
  const q = req.query as Record<string, string>;
  const lawyerId =
    q.lawyerId === "me" ? req.user!.id : (q.lawyerId || undefined);
  ok(res, await svc.listCasesForStaff({
    page: Math.max(1, Number(q.page ?? 1)),
    pageSize: Math.min(50, Math.max(1, Number(q.pageSize ?? 20))),
    view: q.view,
    status: q.status || undefined,
    lawyerId,
    search: q.search || undefined,
  }));
});

router.get("/staff/matters/:enquiryId", requirePermission("case.viewAll"), async (req, res) => {
  ok(res, { enquiry: await svc.getCaseForStaff(String(req.params.enquiryId)) });
});

router.post(
  "/staff/enquiries/:id/open-case",
  requirePermission("case.manage"),
  async (req, res) => {
    ok(res, { case: await svc.openCase(String(req.params.id), req.user!, req.ip) }, 201);
  },
);

router.post(
  "/staff/enquiries/:id/escalate",
  requirePermission("case.observe"),
  validate({ body: z.object({ note: z.string().trim().min(5).max(1000) }) }),
  async (req, res) => {
    ok(res, await svc.escalate(String(req.params.id), req.user!, req.body.note, req.ip));
  },
);

// ------------------------------------------------------- case operations

/** Role-scoped case bundle: case core + threads + timeline. */
router.get("/cases/:id", requireAuth, async (req, res) => {
  const kase = await prisma.case.findUnique({
    where: { id: String(req.params.id) },
    include: {
      enquiry: { select: { id: true, reference: true, purpose: true, submittedAt: true } },
      property: {
        select: {
          id: true, reference: true, title: true, listingType: true, price: true,
          area: true, lga: true, state: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
      client: { select: { id: true, name: true, email: true, phone: true } },
      provider: { select: { id: true, name: true, email: true, phone: true, organisation: true } },
      lawyer: { select: { id: true, name: true } },
    },
  });
  if (!kase) throw ApiError.notFound("Case not found.");

  const staff = (await import("../../lib/permissions.js")).can(req.user, "case.viewAll");
  const isClient = kase.clientId === req.user!.id;
  const isProvider = kase.providerId === req.user!.id;
  if (!staff && !isClient && !isProvider) throw ApiError.forbidden();

  // Contact details stay hidden from the other party until the lawyer
  // authorises a disclosure (contact.disclose permission).
  let clientSummary: { id: string; name: string; email: string | null; phone: string | null } = {
    id: kase.client.id, name: kase.client.name, email: null, phone: null,
  };
  let providerSummary: { id: string; name: string; organisation: string | null; email: string | null; phone: string | null } = {
    id: kase.provider.id, name: kase.provider.name, organisation: kase.provider.organisation, email: null, phone: null,
  };

  if (staff) {
    clientSummary = { ...clientSummary, email: kase.client.email, phone: kase.client.phone };
    providerSummary = { ...providerSummary, email: kase.provider.email, phone: kase.provider.phone };
  } else if (isProvider) {
    providerSummary = { ...providerSummary, email: kase.provider.email, phone: kase.provider.phone };
  } else if (isClient) {
    clientSummary = { ...clientSummary, email: kase.client.email, phone: kase.client.phone };
  }

  // A disclosure permanently unlocks the counterpart's contact details for
  // the receiving party, so they show on every load — not only in the
  // one-off "Contact details shared with you" notification. (Disclosure
  // semantics: party = the party receiving the details, matching the
  // disclose endpoint and its notifications.)
  if (!staff) {
    const disclosures = await prisma.contactDisclosure.findMany({
      where: { caseId: kase.id, disclosedTo: req.user!.id },
      select: { party: true },
    });
    const revealed = new Set(disclosures.map((d) => d.party));
    if (isClient && revealed.has("client")) {
      providerSummary = { ...providerSummary, email: kase.provider.email, phone: kase.provider.phone };
    }
    if (isProvider && revealed.has("provider")) {
      clientSummary = { ...clientSummary, email: kase.client.email, phone: kase.client.phone };
    }
  }

  const threads = await svc.getThreads(req.user!, kase.id);
  const timeline = await svc.getTimeline(req.user!, kase.id);
  const payments = await prisma.payment.findMany({
    where: { caseId: kase.id },
    orderBy: { createdAt: "desc" },
    // Providers see status/amount only — no payer contact details.
    select: { id: true, reference: true, amount: true, description: true, status: true, dueDate: true, paidAt: true, createdAt: true },
  });

  ok(res, {
    case: {
      id: kase.id,
      reference: kase.reference,
      status: kase.status,
      openedAt: kase.openedAt,
      closedAt: kase.closedAt,
      enquiry: kase.enquiry,
      property: kase.property,
      client: clientSummary,
      provider: providerSummary,
      lawyer: kase.lawyer,
    },
    threads: threads.threads,
    messages: threads.messages,
    timeline,
    payments,
  });
});

router.patch(
  "/cases/:id/status",
  requirePermission("case.manage"),
  validate({
    body: z.object({
      status: z.enum([
        "IN_PROGRESS",
        "NEGOTIATION", "PAYMENT_PENDING", "COMPLETED", "CANCELLED",
      ]),
      note: z.string().trim().max(1000).optional().or(z.literal("")),
    }),
  }),
  async (req, res) => {
    ok(res, { case: await svc.updateStatus(String(req.params.id), req.user!, req.body.status, req.body.note || undefined, req.ip) });
  },
);

router.get("/cases/:id/threads", requireAuth, async (req, res) => {
  ok(res, await svc.getThreads(req.user!, String(req.params.id)));
});

router.post(
  "/cases/:id/messages",
  requireAuth,
  validate({
    body: z.object({
      thread: z.enum(["CLIENT", "PROVIDER", "INTERNAL"]),
      body: z.string().trim().min(1).max(4000),
    }),
  }),
  async (req, res) => {
    ok(res, { message: await svc.postMessage(req.user!, String(req.params.id), req.body.thread, req.body.body) }, 201);
  },
);

/**
 * Contact disclosure (lawyer only). Authorises the release of one party's
 * contact details to the other, records the disclosure and notifies the
 * receiving party. Every disclosure is audited.
 */
router.post(
  "/cases/:id/disclose",
  requirePermission("contact.disclose"),
  validate({
    body: z.object({
      party: z.enum(["client", "provider"]),
      note: z.string().trim().max(500).optional().or(z.literal("")),
    }),
  }),
  async (req, res) => {
    const kase = await prisma.case.findUnique({
      where: { id: String(req.params.id) },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        provider: { select: { id: true, name: true, email: true, phone: true, organisation: true } },
        enquiry: { select: { id: true, reference: true } },
      },
    });
    if (!kase) throw ApiError.notFound("Case not found.");

    const { party, note } = req.body as { party: "client" | "provider"; note?: string };
    await prisma.contactDisclosure.create({
      data: {
        caseId: kase.id,
        party,
        disclosedTo: party === "client" ? kase.clientId : kase.providerId,
        disclosedBy: req.user!.id,
      },
    });

    if (party === "client") {
      await notifyMany([
        {
          userId: kase.clientId,
          category: "case_update",
          title: "Contact details shared with you",
          body: `Your lawyer has shared the property provider's details: ${kase.provider.name}${kase.provider.organisation ? ` (${kase.provider.organisation})` : ""}${kase.provider.phone ? ", " + kase.provider.phone : ""}${kase.provider.email ? ", " + kase.provider.email : ""}.`,
          link: `/app/client/enquiries/${kase.enquiry.id}`,
        },
      ]);
    } else {
      await notifyMany([
        {
          userId: kase.providerId,
          category: "case_update",
          title: "Contact details shared with you",
          body: `Your lawyer has shared the client's details: ${kase.client.name}${kase.client.phone ? ", " + kase.client.phone : ""}${kase.client.email ? ", " + kase.client.email : ""}.`,
          link: `/app/provider/cases/${kase.id}`,
        },
      ]);
    }
    await prisma.caseTimelineEntry.create({
      data: {
        caseId: kase.id,
        actorId: req.user!.id,
        label: `Contact details disclosed to the ${party}.`,
        visibility: "INTERNAL",
        note: note || undefined,
      },
    });
    await audit({
      actorId: req.user!.id,
      action: "contact.disclose",
      entityType: "Case",
      entityId: kase.id,
      meta: { party },
      ip: req.ip,
    });
    ok(res, { disclosed: true });
  },
);

// ------------------------------------------------------ provider routes

router.get("/provider/cases", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  ok(res, { cases: await svc.listCasesForProvider(req.user!.id) });
});

router.get("/provider/cases/:id", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  ok(res, { case: await svc.getForProvider(req.user!.id, String(req.params.id)) });
});

export default router;
