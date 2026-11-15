import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, pageSchema, pageSizeSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { paymentLimiter } from "../../middleware/rateLimit.js";
import { can } from "../../lib/permissions.js";
import * as svc from "./service.js";
import * as flw from "../../lib/flutterwave.js";

/**
 * Payment routes.
 *
 * Client:   GET  /client/payments          own requests + history
 *           POST /client/payments/:id/pay        -> Flutterwave checkout link
 *           POST /client/payments/:id/verify     server-side verification
 *           POST /client/payments/:id/transfer   report a bank transfer
 * Staff:    GET  /staff/payments (+summary), POST request / confirm / fail
 * Webhook:  POST /payments/webhook  (signature checked; configuration later)
 */
const router = Router();

// ------------------------------------------------------------- client

router.get("/client/payments", requireAuth, async (req, res) => {
  const q = (req.validated?.query ?? {}) as Record<string, string>;
  ok(res, await svc.listForClient(req.user!.id, {
    page: Math.max(1, Number(q.page ?? 1)),
    pageSize: Math.min(50, Math.max(1, Number(q.pageSize ?? 20))),
    status: q.status || undefined,
  }));
});

// Bank account details for the PRIMARY manual transfer method. Must be
// registered before "/client/payments/:id" so "bank-details" is not read
// as an :id. Revealed only at the payment stage (active request) or to staff.
router.get("/client/payments/bank-details", requireAuth, async (req, res) => {
  const user = req.user!;
  const details = await svc.bankTransferDetails(user.id, can(user, "workspace.staff"));
  if (!details) throw ApiError.forbidden("Bank details become available once you have an active payment request.");
  ok(res, { details });
});

router.get("/client/payments/:id", requireAuth, async (req, res) => {
  ok(res, { payment: await svc.getById(req.user!, String(req.params.id)) });
});

router.post(
  "/client/payments/:id/pay",
  requireAuth,
  paymentLimiter,
  async (req, res) => {
    if (req.user!.role !== "CLIENT") throw ApiError.forbidden();
    const { link, processorReference } = await svc.initiateCard(req.user!, String(req.params.id), req.ip);
    ok(res, { link, processorReference });
  },
);

router.post(
  "/client/payments/:id/verify",
  requireAuth,
  paymentLimiter,
  validate({
    body: z.object({ processorReference: z.string().min(4) }),
  }),
  async (req, res) => {
    const result = await svc.verifyCardPayment(String(req.params.id), req.body.processorReference, req.user, req.ip);
    ok(res, result);
  },
);

router.post(
  "/client/payments/:id/transfer",
  requireAuth,
  paymentLimiter,
  validate({
    body: z.object({
      note: z.string().trim().max(500).optional().or(z.literal("")),
      amount: z.coerce.number().int().min(1).optional(),
    }),
  }),
  async (req, res) => {
    if (req.user!.role !== "CLIENT") throw ApiError.forbidden();
    // Guard: a reported transfer must match the requested amount.
    const payment = await svc.getById(req.user!, String(req.params.id));
    if (req.body.amount && req.body.amount !== payment.amount) {
      throw ApiError.badRequest("Please check the highlighted fields.", {
        amount: "The transferred amount must match the payment request.",
      });
    }
    ok(res, await svc.reportTransfer(req.user!, String(req.params.id), req.body.note, req.ip));
  },
);

// -------------------------------------------------------------- staff

router.get(
  "/staff/payments",
  requirePermission("payment.manage"),
  validate({
    query: z.object({
      page: pageSchema.optional(),
      pageSize: pageSizeSchema.optional(),
      status: z.string().trim().max(30).optional(),
      search: z.string().trim().max(80).optional(),
    }),
  }),
  async (req, res) => {
    const q = req.validated!.query as never as { page?: number; pageSize?: number; status?: string; search?: string };
    const [list, summary] = await Promise.all([
      svc.listForStaff({
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 20,
        status: q.status || undefined,
        search: q.search || undefined,
      }),
      svc.staffSummary(),
    ]);
    ok(res, { ...list, summary });
  },
);

router.get("/staff/payments/:id", requirePermission("payment.manage"), async (req, res) => {
  ok(res, { payment: await svc.getById(req.user!, String(req.params.id)) });
});

router.post(
  "/staff/payments",
  requirePermission("payment.manage"),
  validate({
    body: z.object({
      caseId: z.string().min(1),
      amount: z.coerce.number().int().min(1, "Enter an amount greater than zero.").max(2_000_000_000),
      description: z.string().trim().min(3, "Describe the payment, e.g. “First year's rent”.").max(200),
      dueDate: z.string().datetime({ offset: true }).optional().or(z.string().min(4).max(40)),
    }),
  }),
  async (req, res) => {
    ok(res, { payment: await svc.createRequest(req.user!, req.body, req.ip) }, 201);
  },
);

router.post(
  "/staff/payments/:id/confirm-transfer",
  requirePermission("payment.manage"),
  async (req, res) => {
    ok(res, await svc.confirmTransfer(req.user!, String(req.params.id), req.ip));
  },
);

router.post(
  "/staff/payments/:id/fail",
  requirePermission("payment.manage"),
  validate({ body: z.object({ reason: z.string().trim().max(500).optional().or(z.literal("")) }) }),
  async (req, res) => {
    ok(res, await svc.markFailed(req.user!, String(req.params.id), req.body.reason, req.ip));
  },
);

// ------------------------------------------------------------- webhook

/**
 * Flutterwave webhook receiver.
 *
 * The signature header ("verif-hash") is checked against FLW_WEBHOOK_SECRET.
 * Webhook configuration will be completed later (see README); the handler
 * is production-ready so no restructuring is needed when the secret is set:
 * it always re-verifies the transaction via the API before confirming.
 */
router.post("/payments/webhook", async (req, res) => {
  const signature = req.headers["verif-hash"] as string | undefined;
  if (!flw.webhookSignatureValid(signature)) {
    // While no secret is configured every request is rejected — the same
    // code path that will run once the webhook is registered.
    throw new ApiError(401, "WEBHOOK", "Invalid webhook signature.");
  }

  const event = req.body as {
    event?: string;
    data?: { tx_ref?: string; status?: string; id?: number };
  };
  const txRef = event.data?.tx_ref ?? "";
  const payment = txRef
    ? await prismaPaymentByProcessorReference(txRef)
    : null;

  if (payment) {
    try {
      await svc.verifyCardPayment(payment.id, txRef, null, req.ip);
    } catch {
      // Never fail the webhook on verification hiccups; Flutterwave retries.
    }
  }
  res.status(200).json({ ok: true, data: { received: true } });
});

async function prismaPaymentByProcessorReference(processorReference: string) {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { processorReference },
    select: { paymentId: true },
  });
  return attempt ? { id: attempt.paymentId } : null;
}

export default router;
