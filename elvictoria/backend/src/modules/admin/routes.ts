import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/notify.js";
import { staffListingsSummary } from "../properties/routes.js";

/**
 * Administrative module: role dashboards, reports and platform settings.
 */
const router = Router();

// ------------------------------------------------------ staff dashboard

router.get("/staff/summary", requirePermission("workspace.staff"), async (_req, res) => {
  const listings = await staffListingsSummary();

  const [
    users,
    enquiriesTotal,
    openCases,
    completedCases,
    requiringAttention,
    payments,
    mattersByStatusRaw,
    attentionList,
    unassignedCount,
    escalatedCount,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.enquiry.count(),
    prisma.case.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.case.count({ where: { status: "COMPLETED" } }),
    prisma.case.count({
      where: {
        OR: [
          { enquiry: { lawyerId: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } },
          { enquiry: { escalations: { some: {} } } },
          { status: "PAYMENT_PENDING" },
        ],
      },
    }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.enquiry.findMany({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        OR: [{ lawyerId: null }, { escalations: { some: {} } }, { status: "PAYMENT_PENDING" }],
      },
      orderBy: { submittedAt: "desc" },
      take: 6,
      select: {
        id: true, reference: true, status: true, submittedAt: true,
        property: { select: { reference: true, title: true } },
        client: { select: { name: true } },
        escalations: { take: 1, orderBy: { at: "desc" }, select: { note: true } },
      },
    }),
    prisma.enquiry.count({ where: { lawyerId: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.enquiry.count({ where: { escalations: { some: {} }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
  ]);

  let pendingPayments = { count: 0, amount: 0 };
  let successfulPayments = { count: 0, amount: 0 };
  for (const g of payments) {
    const amount = Number(g._sum.amount ?? 0);
    if (g.status === "SUCCESSFUL") successfulPayments = { count: g._count._all, amount };
    if (g.status === "OUTSTANDING" || g.status === "AWAITING_PAYMENT" || g.status === "PENDING_CONFIRMATION") {
      pendingPayments.count += g._count._all;
      pendingPayments.amount += amount;
    }
  }

  ok(res, {
    listings,
    users,
    enquiriesTotal,
    openCases,
    completedCases,
    requiringAttention,
    pendingPayments,
    successfulPayments,
    mattersByStatus: Object.fromEntries(mattersByStatusRaw.map((m) => [m.status, m._count._all])),
    unassignedCount,
    escalatedCount,
    attentionList,
  });
});

// ----------------------------------------------------- client dashboard

router.get("/client/summary", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const [activeEnquiries, ongoingTransactions, completed, pendingPayments, recentUpdates, unread] =
    await Promise.all([
      prisma.enquiry.count({ where: { clientId: userId, status: { in: ["IN_PROGRESS"] } } }),
      prisma.case.count({ where: { clientId: userId, status: { in: ["IN_PROGRESS", "NEGOTIATION", "PAYMENT_PENDING"] } } }),
      prisma.case.count({ where: { clientId: userId, status: "COMPLETED" } }),
      prisma.payment.count({ where: { payerId: userId, status: { in: ["OUTSTANDING", "AWAITING_PAYMENT", "PENDING_CONFIRMATION"] } } }),
      prisma.caseTimelineEntry.findMany({
        where: { case: { clientId: userId }, visibility: "PARTICIPANTS" },
        orderBy: { at: "desc" },
        take: 5,
        select: {
          id: true, at: true, note: true, label: true,
          case: {
            select: {
              id: true, enquiryId: true, reference: true, status: true,
              property: { select: { title: true, images: { take: 1, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], select: { url: true, label: true } } } },
            },
          },
        },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
  ok(res, { activeEnquiries, ongoingTransactions, completed, pendingPayments, recentUpdates, unread });
});

// --------------------------------------------------- provider dashboard

router.get("/provider/summary", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const [totals, enquiries, inProgress, needsChanges, recentActivity] = await Promise.all([
    prisma.property.groupBy({ by: ["status"], _count: { _all: true }, where: { providerId: userId } }),
    prisma.case.count({ where: { providerId: userId } }),
    prisma.case.count({ where: { providerId: userId, status: { in: ["IN_PROGRESS", "NEGOTIATION", "PAYMENT_PENDING"] } } }),
    prisma.property.findFirst({
      where: { providerId: userId, status: "CHANGES_REQUESTED" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, reference: true, title: true, feedback: true },
    }),
    prisma.caseTimelineEntry.findMany({
      where: { case: { providerId: userId }, visibility: "PARTICIPANTS" },
      orderBy: { at: "desc" },
      take: 6,
      select: { id: true, at: true, label: true, note: true, case: { select: { id: true, reference: true } } },
    }),
  ]);

  const counts = { total: 0, active: 0, pendingReview: 0, changesRequested: 0 };
  for (const t of totals) {
    counts.total += t._count._all;
    if (t.status === "APPROVED") counts.active = t._count._all;
    if (t.status === "PENDING_REVIEW") counts.pendingReview = t._count._all;
    if (t.status === "CHANGES_REQUESTED") counts.changesRequested = t._count._all;
  }
  ok(res, { ...counts, enquiries, inProgress, needsChanges, recentActivity });
});

// -------------------------------------------------------------- reports

router.get("/reports", requirePermission("reports.view"), async (_req, res) => {
  const [listingsByCategory, casesByStatus, paymentsByStatus, usersByRole, monthlyPayments] =
    await Promise.all([
      prisma.property.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.payment.findMany({
        where: { status: "SUCCESSFUL" },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: "desc" },
        take: 200,
      }),
    ]);

  // Group successful payments into calendar months (for the chart).
  const byMonth = new Map<string, number>();
  for (const p of monthlyPayments) {
    if (!p.paidAt) continue;
    const key = `${p.paidAt.getUTCFullYear()}-${String(p.paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount);
  }
  const paymentsTrend = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }));

  ok(res, {
    listingsByCategory: listingsByCategory.map((r) => ({ category: r.category, count: r._count._all })),
    casesByStatus: casesByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    paymentsByStatus: paymentsByStatus.map((r) => ({
      status: r.status, count: r._count._all, amount: Number(r._sum.amount ?? 0),
    })),
    usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count._all })),
    paymentsTrend,
  });
});

// ------------------------------------------------------------- settings

const SETTINGS_KEYS = [
  "officeAddress",
  "officePhone",
  "officeEmail",
  "officeHours",
  "enquiryAcknowledgement",
  "paymentDueDays",
  // Listing media limits (apply to every lister; consumed by the upload
  // endpoints and shown to providers by the property form).
  "videoMaxMb",
  "videoMaxDurationSec",
] as const;

/**
 * Public contact settings (footer / contact page). Only the safe,
 * non-sensitive fields are exposed — no auth required.
 */
router.get("/settings/public", async (_req, res) => {
  const rows = await prisma.setting.findMany({
    // office* feed the footer/contact page; the video limits are exposed so
    // the property form can show every lister the same admin-set limits.
    where: {
      key: {
        in: ["officeAddress", "officePhone", "officeEmail", "officeHours", "videoMaxMb", "videoMaxDurationSec"],
      },
    },
  });
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  ok(res, { settings });
});

router.get("/settings", requirePermission("workspace.staff"), async (_req, res) => {
  // Bank keys are included so the settings form round-trips them — reading
  // without them made every save wipe the bank account with blanks.
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          ...(SETTINGS_KEYS as unknown as string[]),
          "bankName",
          "bankAccountName",
          "bankAccountNumber",
        ],
      },
    },
  });
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  ok(res, { settings });
});

router.put(
  "/settings",
  requirePermission("settings.manage"),
  validate({
    body: z.object({
      settings: z.object({
        officeAddress: z.string().trim().max(200).optional(),
        officePhone: z.string().trim().max(40).optional(),
        officeEmail: z.string().trim().email().optional().or(z.literal("")),
        officeHours: z.string().trim().max(120).optional(),
        enquiryAcknowledgement: z.string().trim().max(300).optional(),
        paymentDueDays: z.coerce.number().int().min(1).max(60).optional(),
        // ELVICTORIA's receiving account for the primary manual bank
        // transfer method — shown to a payer only at the payment stage.
        bankName: z.string().trim().max(80).optional(),
        bankAccountName: z.string().trim().max(80).optional(),
        bankAccountNumber: z.string().trim().max(30).optional(),
        // Listing media limits (see uploads module for the consuming side).
        videoMaxMb: z.coerce.number().int().min(1).max(500).optional(),
        videoMaxDurationSec: z.coerce.number().int().min(10).max(600).optional(),
      }),
    }),
  }),
  async (req, res) => {
    const entries = Object.entries(req.body.settings as Record<string, string>);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
    );
    await audit({
      actorId: req.user!.id,
      action: "settings.update",
      entityType: "Setting",
      meta: { keys: entries.map(([k]) => k) },
      ip: req.ip,
    });
    ok(res, { updated: entries.length });
  },
);

// -------------------------------------------------------- contact form

/**
 * Public contact form. Verified submissions notify every lawyer; no account
 * is required (the office email/address are shown on the same page).
 */
router.post(
  "/contact",
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      subject: z.string().trim().min(3).max(140),
      message: z.string().trim().min(10).max(4000),
    }),
  }),
  async (req, res) => {
    const { name, email, subject, message } = req.body;
    const { notifyAllLawyers } = await import("../../lib/notify.js");
    await notifyAllLawyers([
      {
        category: "admin_alert",
        title: "Website contact form",
        body: `${name} <${email}>: ${subject} — ${message.slice(0, 120)}`,
      },
    ]);
    ok(res, { message: "Thank you. A member of our legal team will review your message shortly." });
  },
);

export default router;
