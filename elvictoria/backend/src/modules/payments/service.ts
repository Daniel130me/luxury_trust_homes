import { AttemptMethod, AttemptOutcome, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/errors.js";
import { can, type AuthUser } from "../../lib/permissions.js";
import { audit, notifyMany, notifyAllLawyers } from "../../lib/notify.js";
import { nextReference } from "../../lib/references.js";
import * as flw from "../../lib/flutterwave.js";
import { env } from "../../config/env.js";

/**
 * Payment requests and processing.
 *
 * Flow (mirrors the prototype, backed by real Flutterwave in test mode):
 * 1. Lawyer raises a request against a case (amount, description, due date).
 * 2. Client pays: debit card -> Flutterwave hosted checkout (this backend
 *    creates the session and later verifies the transaction server-side);
 *    bank transfer -> client reports the transfer, lawyer confirms receipt.
 * 3. A payment is only marked SUCCESSFUL after backend verification that
 *    the reference, amount, currency and status match. Redirects and
 *    callbacks alone are never trusted.
 */

const UNPAID_STATUSES: PaymentStatus[] = ["OUTSTANDING", "AWAITING_PAYMENT", "FAILED"];

// ------------------------------------------------------- create request

export type CreateRequestInput = {
  caseId: string;
  amount: number;
  description: string;
  dueDate?: string;
};

export async function createRequest(actor: AuthUser, input: CreateRequestInput, ip?: string) {
  const kase = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: {
      id: true, reference: true, clientId: true, providerId: true, status: true,
      enquiry: { select: { id: true, reference: true } },
    },
  });
  if (!kase) throw ApiError.notFound("Case not found.");
  if (["COMPLETED", "CANCELLED"].includes(kase.status)) {
    throw ApiError.badRequest("Payments cannot be raised on a closed case.");
  }

  const dueDays = 7; // settings.paymentDueDays — mirrored from the prototype
  const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + dueDays * 86400_000);

  const payment = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx as never, "payment");
    const created = await tx.payment.create({
      data: {
        reference,
        caseId: kase.id,
        payerId: kase.clientId,
        requestedById: actor.id,
        amount: input.amount,
        description: input.description.trim(),
        dueDate,
        status: PaymentStatus.OUTSTANDING,
      },
    });
    await tx.caseTimelineEntry.createMany({
      data: [
        {
          caseId: kase.id,
          actorId: actor.id,
          label: `Payment request ${reference} for ₦${input.amount.toLocaleString("en-NG")} raised by ${actor.name}: ${input.description.trim()}.`,
          visibility: "INTERNAL",
        },
        {
          caseId: kase.id,
          actorId: actor.id,
          label: `Payment request ${reference} for ₦${input.amount.toLocaleString("en-NG")} raised by ${actor.name}: ${input.description.trim()}.`,
          visibility: "PARTICIPANTS",
          note: `Payment of ₦${input.amount.toLocaleString("en-NG")} requested: ${input.description.trim()}.`,
        },
      ],
    });
    return created;
  });

  // A payment request moves the case to PAYMENT_PENDING.
  if (kase.status !== "PAYMENT_PENDING") {
    await prisma.case.update({ where: { id: kase.id }, data: { status: "PAYMENT_PENDING" } });
    await prisma.enquiry.update({
      where: { id: kase.enquiry.id },
      data: { status: "PAYMENT_PENDING" },
    });
    await prisma.caseTimelineEntry.create({
      data: {
        caseId: kase.id,
        actorId: actor.id,
        label: "Status changed to Payment Pending.",
        visibility: "PARTICIPANTS",
        note: "A payment request is waiting for you.",
      },
    });
  }

  await notifyMany([
    {
      userId: kase.clientId,
      category: "case_update",
      title: "Payment requested",
      body: `A payment request of ₦${input.amount.toLocaleString("en-NG")} was raised on ${kase.reference}: ${input.description.trim()}.`,
      link: `/app/client/payments/${payment.id}`,
    },
    {
      userId: kase.providerId,
      category: "case_update",
      title: "Payment requested",
      body: `A payment request of ₦${input.amount.toLocaleString("en-NG")} was raised on ${kase.reference}.`,
      link: `/app/provider/cases/${kase.id}`,
    },
  ]);
  await audit({
    actorId: actor.id,
    action: "payment.request",
    entityType: "Payment",
    entityId: payment.id,
    meta: { reference: payment.reference, amount: input.amount },
    ip,
  });
  return payment;
}

// -------------------------------------------------------- amount editing

/** Amounts may change while the request is still open; settled ones never. */
const EDITABLE_AMOUNT_STATUSES: PaymentStatus[] = [
  PaymentStatus.OUTSTANDING,
  PaymentStatus.AWAITING_PAYMENT,
  PaymentStatus.FAILED,
];

/**
 * Change the amount of a payment request (payment.manage).
 *
 * The client may dispute the figure or the matter may need re-scoping, so
 * staff can correct the amount while it is open. A transfer the client
 * already reported (PENDING_CONFIRMATION) is locked to the figure they
 * actually paid — confirm or fail that transfer first.
 */
export async function updateAmount(
  actor: AuthUser,
  paymentId: string,
  amount: number,
  reason: string | undefined,
  ip?: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: { select: { id: true, reference: true, clientId: true, providerId: true } },
    },
  });
  if (!payment) throw ApiError.notFound("Payment request not found.");
  if (!EDITABLE_AMOUNT_STATUSES.includes(payment.status)) {
    throw ApiError.badRequest(
      payment.status === PaymentStatus.PENDING_CONFIRMATION
        ? "The client has already reported a transfer at the current amount — confirm or fail that transfer before changing the amount."
        : "This payment request can no longer be changed.",
    );
  }
  if (amount === payment.amount) {
    throw ApiError.badRequest("The amount is unchanged.");
  }

  const naira = (v: number) => `₦${v.toLocaleString("en-NG")}`;
  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({ where: { id: paymentId }, data: { amount } });
    await tx.caseTimelineEntry.createMany({
      data: [
        {
          caseId: payment.case.id,
          actorId: actor.id,
          label: `Payment request ${payment.reference} amount changed from ${naira(payment.amount)} to ${naira(amount)} by ${actor.name}.`,
          visibility: "INTERNAL",
        },
        {
          caseId: payment.case.id,
          actorId: actor.id,
          label: `Payment request ${payment.reference} amount changed from ${naira(payment.amount)} to ${naira(amount)} by ${actor.name}.`,
          visibility: "PARTICIPANTS",
          note: `The requested amount is now ${naira(amount)}${reason ? ` — ${reason}` : ""}.`,
        },
      ],
    });
    return p;
  });

  await notifyMany([
    {
      userId: payment.case.clientId,
      category: "case_update",
      title: "Payment request updated",
      body: `The amount for ${payment.reference} on ${payment.case.reference} changed from ${naira(payment.amount)} to ${naira(amount)}${reason ? `: ${reason}` : ""}.`,
      link: `/app/client/payments/${payment.id}`,
    },
    {
      userId: payment.case.providerId,
      category: "case_update",
      title: "Payment request updated",
      body: `The amount for ${payment.reference} on ${payment.case.reference} changed from ${naira(payment.amount)} to ${naira(amount)}.`,
      link: `/app/provider/cases/${payment.case.id}`,
    },
  ]);
  await audit({
    actorId: actor.id,
    action: "payment.amount_update",
    entityType: "Payment",
    entityId: paymentId,
    meta: { reference: payment.reference, from: payment.amount, to: amount, reason: reason ?? null },
    ip,
  });
  return updated;
}

// --------------------------------------------------------- card payment

function txRefFor(payment: { reference: string }): string {
  // Unique processor reference per attempt (idempotency + reconciliation).
  return `${payment.reference}-${Date.now().toString(36)}`;
}

export async function initiateCard(
  actor: AuthUser,
  paymentId: string,
  ip?: string,
): Promise<{ link: string; processorReference: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      payer: { select: { id: true, name: true, email: true, phone: true } },
      case: { select: { id: true, reference: true } },
    },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.payerId !== actor.id) throw ApiError.forbidden();
  if (payment.status === PaymentStatus.SUCCESSFUL) {
    throw ApiError.conflict("This payment has already been made.");
  }
  if (!UNPAID_STATUSES.includes(payment.status) && payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
    throw ApiError.badRequest("This payment cannot be started right now.");
  }
  if (payment.status === PaymentStatus.PENDING_CONFIRMATION) {
    throw ApiError.badRequest("A bank transfer is already awaiting confirmation for this payment.");
  }

  const processorReference = txRefFor(payment);
  let link: string;
  try {
    const session = await flw.initiateCardPayment({
      txRef: processorReference,
      amount: payment.amount,
      customerEmail: payment.payer.email,
      customerName: payment.payer.name,
      customerPhone: payment.payer.phone ?? undefined,
      redirectUrl: `${env.FRONTEND_URL}/app/client/payments/${payment.id}`,
      description: `${payment.case.reference} — ${payment.description}`.slice(0, 200),
    });
    link = session.link;
  } catch (err) {
    // Keep a failed-initiation attempt for the audit trail; payment stays
    // in its previous state so the client can retry.
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        method: AttemptMethod.CARD,
        outcome: AttemptOutcome.FAILED,
        message: `Could not start payment session: ${(err as Error).message}`,
        processorReference,
      },
    });
    throw new ApiError(502, "GATEWAY", "Could not reach the payment gateway. Please try again.");
  }

  await prisma.$transaction([
    prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        method: AttemptMethod.CARD,
        outcome: AttemptOutcome.INITIATED,
        processorReference,
        message: "Checkout session opened.",
      },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.AWAITING_PAYMENT },
    }),
  ]);
  await audit({
    actorId: actor.id,
    action: "payment.initiate",
    entityType: "Payment",
    entityId: payment.id,
    meta: { processorReference },
    ip,
  });
  return { link, processorReference };
}

/**
 * Verify a card payment after the hosted checkout redirect (or webhook).
 *
 * Idempotent: if the payment is already successful the function returns
 * immediately without creating duplicates. The Flutterwave transaction is
 * verified directly from this backend and the reference, amount and
 * currency are checked before anything is confirmed.
 */
export async function verifyCardPayment(
  paymentId: string,
  processorReference: string,
  actor: AuthUser | null,
  ip?: string,
): Promise<{ status: PaymentStatus }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: { select: { id: true, reference: true, status: true, providerId: true, clientId: true } },
    },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status === PaymentStatus.SUCCESSFUL) return { status: payment.status };
  if (payment.status === PaymentStatus.PENDING_CONFIRMATION) {
    throw ApiError.badRequest("A bank transfer is awaiting confirmation for this payment.");
  }

  const attempt = await prisma.paymentAttempt.findFirst({
    where: { paymentId, processorReference },
    orderBy: { at: "desc" },
  });
  if (!attempt) throw ApiError.badRequest("Unknown payment session. Please start the payment again.");

  let result: flw.VerifyResult;
  try {
    result = await flw.verifyByReference(processorReference);
  } catch (err) {
    // Verification could not be obtained: keep the payment unresolved
    // (never falsely successful) and let the client retry.
    await prisma.paymentAttempt.create({
      data: {
        paymentId,
        method: AttemptMethod.CARD,
        outcome: AttemptOutcome.FAILED,
        processorReference,
        message: `Verification unavailable: ${(err as Error).message}`,
      },
    });
    throw new ApiError(502, "GATEWAY", "Could not verify the payment now. It remains pending — try again shortly.");
  }

  // Guards: amount, currency and status must match what was requested.
  if (result.currency !== "NGN" || result.amount !== payment.amount) {
    await prisma.paymentAttempt.create({
      data: {
        paymentId,
        method: AttemptMethod.CARD,
        outcome: AttemptOutcome.FAILED,
        processorReference,
        processorTxId: result.processorTxId,
        message: `Mismatch: expected ₦${payment.amount} NGN, gateway reported ₦${result.amount} ${result.currency}.`,
      },
    });
    throw ApiError.badRequest(
      "The payment amount did not match the request. No charge has been recorded — contact support.",
    );
  }

  if (result.status === "successful") {
    await confirmSuccessful(payment.id, processorReference, result.processorTxId, "card", actor, ip);
    return { status: PaymentStatus.SUCCESSFUL };
  }

  if (result.status === "failed") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      }),
      prisma.paymentAttempt.create({
        data: {
          paymentId,
          method: AttemptMethod.CARD,
          outcome: AttemptOutcome.FAILED,
          processorReference,
          processorTxId: result.processorTxId,
          message: "The payment attempt was unsuccessful.",
        },
      }),
      prisma.caseTimelineEntry.create({
        data: {
          caseId: payment.case.id,
          actorId: payment.payerId,
          label: `Payment attempt on ${payment.reference} failed.`,
          visibility: "PARTICIPANTS",
          note: "A payment attempt was unsuccessful. You can try again.",
        },
      }),
    ]);
    await notifyMany([
      { userId: payment.case.clientId, category: "payment_failure", title: "Payment attempt failed", body: `A payment attempt on ${payment.reference} failed. You can try again.`, link: `/app/client/payments/${payment.id}` },
      { userId: payment.case.providerId, category: "payment_failure", title: "Payment attempt failed", body: `A payment attempt on ${payment.reference} failed.`, link: `/app/provider/cases/${payment.case.id}` },
    ]);
    return { status: PaymentStatus.FAILED };
  }

  // Still pending at the gateway — leave as AWAITING_PAYMENT.
  return { status: PaymentStatus.AWAITING_PAYMENT };
}

/**
 * Shared success path (card + confirmed transfer).
 * Uses a conditional update so concurrent verifications cannot double-
 * confirm the same payment.
 */
async function confirmSuccessful(
  paymentId: string,
  processorReference: string,
  processorTxId: string | null,
  methodLabel: string,
  actor: AuthUser | null,
  ip?: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: { select: { id: true, reference: true, status: true, providerId: true, clientId: true } },
      payer: { select: { id: true, name: true } },
    },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");

  // Idempotency guard against duplicate confirmations (webhook + redirect).
  const claim = await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: PaymentStatus.SUCCESSFUL } },
    data: { status: PaymentStatus.SUCCESSFUL, paidAt: new Date() },
  });
  if (claim.count === 0) return; // already confirmed elsewhere

  await prisma.paymentAttempt.create({
    data: {
      paymentId,
      method: methodLabel === "card" ? AttemptMethod.CARD : AttemptMethod.TRANSFER,
      outcome: AttemptOutcome.SUCCESSFUL,
      processorReference,
      processorTxId,
      message: methodLabel === "card" ? "Approved by issuer." : "Transfer confirmed by the legal team.",
    },
  });

  const amount = `₦${payment.amount.toLocaleString("en-NG")}`;
  await prisma.caseTimelineEntry.createMany({
    data: [
      {
        caseId: payment.case.id,
        actorId: payment.payerId,
        label: `Payment ${payment.reference} of ${amount} received (${methodLabel}).`,
        visibility: "PARTICIPANTS",
        note: `Payment of ${amount} received. Thank you.`,
      },
    ],
  });

  // A settled payment resolves the PAYMENT_PENDING state of the case.
  if (payment.case.status === "PAYMENT_PENDING") {
    await prisma.case.update({ where: { id: payment.case.id }, data: { status: "IN_PROGRESS" } });
    await prisma.enquiry.updateMany({
      where: { case: { id: payment.case.id }, status: "PAYMENT_PENDING" },
      data: { status: "IN_PROGRESS" },
    });
    await prisma.caseTimelineEntry.create({
      data: {
        caseId: payment.case.id,
        actorId: actor?.id ?? null,
        label: "Status changed from Payment Pending to In Progress.",
        visibility: "PARTICIPANTS",
        note: "Payment received; the transaction continues.",
      },
    });
  }

  await notifyAllLawyers([
    {
      category: "payment_success",
      title: "Payment received",
      body: `${payment.payer.name} paid ${amount} on ${payment.case.reference}.`,
      link: `/app/staff/payments?focus=${payment.id}`,
    },
  ]);
  await notifyMany([
    { userId: payment.case.providerId, category: "payment_success", title: "Payment received", body: `Payment of ${amount} received on ${payment.case.reference}.`, link: `/app/provider/cases/${payment.case.id}` },
  ]);
  await audit({
    actorId: actor?.id ?? null,
    action: "payment.success",
    entityType: "Payment",
    entityId: paymentId,
    meta: { processorReference, processorTxId, amount: payment.amount, method: methodLabel },
    ip,
  });
}

// -------------------------------------------------------- bank transfer

/** Client reports an offline bank transfer; a lawyer confirms later. */
export async function reportTransfer(actor: AuthUser, paymentId: string, note?: string, ip?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { case: { select: { id: true, reference: true } } },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.payerId !== actor.id) throw ApiError.forbidden();
  if (payment.status === PaymentStatus.SUCCESSFUL) throw ApiError.conflict("This payment has already been made.");
  if (payment.status === PaymentStatus.PENDING_CONFIRMATION) {
    throw ApiError.badRequest("A transfer is already awaiting confirmation for this payment.");
  }

  const processorReference = `${payment.reference}-TR-${Date.now().toString(36)}`;
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PENDING_CONFIRMATION },
    }),
    prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        method: AttemptMethod.TRANSFER,
        outcome: AttemptOutcome.INITIATED,
        processorReference,
        message: note?.trim() || "Bank transfer reported by the client.",
      },
    }),
    prisma.caseTimelineEntry.create({
      data: {
        caseId: payment.case.id,
        actorId: actor.id,
        label: `Bank transfer reported for ${payment.reference}.`,
        visibility: "PARTICIPANTS",
        note: "Your transfer has been reported and is awaiting confirmation by the legal team.",
      },
    }),
  ]);

  await notifyAllLawyers([
    {
      category: "admin_alert",
      title: "Transfer awaiting confirmation",
      body: `${actor.name} reported a transfer of ₦${payment.amount.toLocaleString("en-NG")} for ${payment.reference} (${payment.case.reference}).`,
      link: `/app/staff/payments?focus=${payment.id}`,
    },
  ]);
  await audit({ actorId: actor.id, action: "payment.report_transfer", entityType: "Payment", entityId: payment.id, ip });
  return { status: PaymentStatus.PENDING_CONFIRMATION };
}

/** Lawyer confirms a reported transfer (payment.manage). */
export async function confirmTransfer(actor: AuthUser, paymentId: string, ip?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { case: { select: { id: true } } },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
    throw ApiError.badRequest("Only transfers awaiting confirmation can be confirmed.");
  }
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { paymentId, method: AttemptMethod.TRANSFER, outcome: AttemptOutcome.INITIATED },
    orderBy: { at: "desc" },
  });
  await confirmSuccessful(
    paymentId,
    attempt?.processorReference ?? `${payment.reference}-TR`,
    null,
    "transfer",
    actor,
    ip,
  );
  return { status: PaymentStatus.SUCCESSFUL };
}

/** Lawyer marks a payment failed/cancelled (payment.manage). */
export async function markFailed(actor: AuthUser, paymentId: string, reason?: string, ip?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { case: { select: { id: true, reference: true } } },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status === PaymentStatus.SUCCESSFUL) {
    throw ApiError.badRequest("A successful payment cannot be marked failed.");
  }
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED },
    }),
    prisma.caseTimelineEntry.create({
      data: {
        caseId: payment.case.id,
        actorId: actor.id,
        label: `Payment ${payment.reference} marked failed by ${actor.name}.`,
        visibility: "PARTICIPANTS",
        note: reason?.trim() || "The payment was cancelled. No funds were taken.",
      },
    }),
  ]);
  await notifyMany([
    { userId: payment.payerId, category: "payment_failure", title: "Payment cancelled", body: `Payment ${payment.reference} was cancelled. No funds were taken. You can try again.`, link: `/app/client/payments/${paymentId}` },
  ]);
  await audit({ actorId: actor.id, action: "payment.mark_failed", entityType: "Payment", entityId: paymentId, meta: { reason }, ip });
  return { status: PaymentStatus.FAILED };
}

// ---------------------------------------------------------------- reads

export async function listForClient(payerId: string, filters: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.PaymentWhereInput = { payerId };
  if (filters.status && Object.values(PaymentStatus).includes(filters.status as PaymentStatus)) {
    where.status = filters.status as PaymentStatus;
  }
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        case: { select: { id: true, reference: true } },
        attempts: { orderBy: { at: "desc" }, take: 1 },
      },
    }),
  ]);
  return { payments, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}

export async function listForStaff(filters: { page: number; pageSize: number; status?: string; search?: string }) {
  const where: Prisma.PaymentWhereInput = {};
  if (filters.status && Object.values(PaymentStatus).includes(filters.status as PaymentStatus)) {
    where.status = filters.status as PaymentStatus;
  }
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { reference: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
      { payer: { is: { name: { contains: s, mode: "insensitive" } } } },
      { case: { is: { reference: { contains: s, mode: "insensitive" } } } },
    ];
  }
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        case: { select: { id: true, reference: true } },
        payer: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { payments, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}

/** Staff summary cards: received, awaiting, transfers to confirm, failed. */
export async function staffSummary() {
  const grouped = await prisma.payment.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
  });
  const summary = {
    received: { count: 0, amount: 0 },
    awaiting: { count: 0, amount: 0 },
    transfersToConfirm: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
    outstanding: { count: 0, amount: 0 },
  };
  for (const g of grouped) {
    const amount = Number(g._sum.amount ?? 0);
    const count = g._count._all;
    if (g.status === "SUCCESSFUL") { summary.received = { count, amount }; }
    if (g.status === "OUTSTANDING" || g.status === "AWAITING_PAYMENT") {
      summary.awaiting.count += count;
      summary.awaiting.amount += amount;
      summary.outstanding.count += count;
      summary.outstanding.amount += amount;
    }
    if (g.status === "PENDING_CONFIRMATION") {
      summary.transfersToConfirm = { count, amount };
      summary.outstanding.count += count;
      summary.outstanding.amount += amount;
    }
    if (g.status === "FAILED") summary.failed = { count, amount };
  }
  return summary;
}

/** Role-scoped detail with attempts. */
export async function getById(user: AuthUser, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: {
        select: {
          id: true, reference: true, status: true,
          property: { select: { reference: true, title: true, images: { take: 1, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], select: { url: true, label: true } } } },
        },
      },
      payer: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      attempts: { orderBy: { at: "desc" } },
    },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");

  const staff = can(user, "payment.manage");
  const isPayer = payment.payerId === user.id;
  const isProviderOnCase = await prisma.case.findFirst({
    where: { id: payment.caseId, providerId: user.id },
    select: { id: true },
  });
  if (!staff && !isPayer && !isProviderOnCase) throw ApiError.forbidden();

  // Clients never see gateway internals; staff see full attempt history.
  const attempts = staff
    ? payment.attempts
    : payment.attempts.filter((a) => a.outcome !== "INITIATED" || a.method === "TRANSFER").map((a) => ({
        id: a.id,
        at: a.at,
        method: a.method,
        outcome: a.outcome,
        message: a.message,
        processorReference: a.processorReference,
      }));
  return { ...payment, attempts };
}

// ------------------------------------------------- bank transfer details

// Manual bank transfer is the PRIMARY payment method; the details are the
// platform's own receiving account, editable by staff in Settings.
const BANK_SETTING_KEYS = ["bankName", "bankAccountName", "bankAccountNumber"];

// A payer "reached the payment stage" when at least one payment request
// is still actionable (outstanding, checkout opened, or transfer reported).
const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ["OUTSTANDING", "AWAITING_PAYMENT", "PENDING_CONFIRMATION"];

/**
 * Return ELVICTORIA's bank account details for the primary manual transfer
 * method — but only once the payer has reached the payment stage (an
 * active payment request exists). Staff always see them; nobody else does,
 * so the account details are never publicly visible. Returns null when the
 * caller is not eligible.
 */
export async function bankTransferDetails(
  userId: string,
  isStaff: boolean,
): Promise<Record<string, string> | null> {
  if (!isStaff) {
    const active = await prisma.payment.count({
      where: { payerId: userId, status: { in: ACTIVE_PAYMENT_STATUSES } },
    });
    if (active === 0) return null;
  }
  const rows = await prisma.setting.findMany({ where: { key: { in: BANK_SETTING_KEYS } } });
  const details: Record<string, string> = {};
  for (const row of rows) details[row.key] = row.value;
  return details;
}
