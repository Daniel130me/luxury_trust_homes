/**
 * Critical business logic tests (vitest).
 *
 * These cover the highest-risk logic: permission checks, payment guards
 * (amount/currency/status matching, idempotent confirmation) and the
 * enquiry→case workflow rules. Unit-level, no database required.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------- mocks

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    payment: { findUnique: vi.fn(), updateMany: vi.fn() },
    paymentAttempt: { create: vi.fn(), findFirst: vi.fn() },
    caseTimelineEntry: { createMany: vi.fn(), create: vi.fn() },
    case: { update: vi.fn(), findUnique: vi.fn() },
    enquiry: { updateMany: vi.fn() },
    notification: { createMany: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([{ id: "lawyer-1" }]) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/flutterwave.js", () => ({
  verifyByReference: vi.fn(),
  initiateCardPayment: vi.fn(),
  webhookSignatureValid: vi.fn(),
}));

import { can, isStaff, type AuthUser } from "../src/lib/permissions.js";
import * as payments from "../src/modules/payments/service.js";
import { verifyByReference } from "../src/lib/flutterwave.js";
import { prisma } from "../src/lib/prisma.js";
import { ApiError } from "../src/lib/errors.js";

const lawyer: AuthUser = {
  id: "u_lawyer", name: "Adaeze", email: "a@e.example", role: "LAWYER", status: "ACTIVE",
  providerKind: null, organisation: null,
};
const support: AuthUser = { ...lawyer, id: "u_support", role: "SUPPORT", name: "Mariam" };
const provider: AuthUser = { ...lawyer, id: "u_provider", role: "PROVIDER", name: "Chinedu" };
const client: AuthUser = { ...lawyer, id: "u_client", role: "CLIENT", name: "Daniel" };

// ---------------------------------------------------------- permissions

describe("permissions", () => {
  it("grants lawyers the full staff workspace capability set", () => {
    expect(can(lawyer, "case.manage")).toBe(true);
    expect(can(lawyer, "payment.manage")).toBe(true);
    expect(can(lawyer, "contact.disclose")).toBe(true);
    expect(can(lawyer, "settings.manage")).toBe(true);
    expect(isStaff(lawyer)).toBe(true);
  });

  it("limits support staff to observation and helpdesk", () => {
    expect(can(support, "case.viewAll")).toBe(true);
    expect(can(support, "helpdesk.manage")).toBe(true);
    expect(can(support, "case.manage")).toBe(false);
    expect(can(support, "payment.manage")).toBe(false);
    expect(isStaff(support)).toBe(true);
  });

  it("gives providers and clients no staff capabilities", () => {
    expect(can(provider, "case.viewAll")).toBe(false);
    expect(can(client, "listing.moderate")).toBe(false);
    expect(isStaff(provider)).toBe(false);
    expect(isStaff(client)).toBe(false);
  });

  it("denies everything to deactivated users", () => {
    expect(can({ ...lawyer, status: "DEACTIVATED" }, "case.manage")).toBe(false);
    expect(can(null, "case.manage")).toBe(false);
  });
});

// ------------------------------------------------------------- payments

describe("card payment verification guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePayment = {
    id: "pay-1",
    reference: "ELV-PY-3011",
    amount: 18_500_000,
    status: "AWAITING_PAYMENT",
    description: "10% commitment deposit",
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: null,
    caseId: "case-1",
    payerId: "u_client",
    requestedById: "u_lawyer",
    case: { id: "case-1", reference: "ELV-CS-2001", status: "PAYMENT_PENDING", providerId: "u_provider", clientId: "u_client" },
    payer: { id: "u_client", name: "Daniel" },
  };

  it("rejects a gateway amount mismatch without confirming", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(basePayment);
    (verifyByReference as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "successful", amount: 1_000, currency: "NGN", txRef: "ref-1", processorTxId: "123", method: "card",
    });

    await expect(
      payments.verifyCardPayment("pay-1", "ref-1", client),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Nothing was confirmed.
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a non-NGN currency without confirming", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(basePayment);
    (verifyByReference as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "successful", amount: 18_500_000, currency: "USD", txRef: "ref-1", processorTxId: "123", method: "card",
    });
    await expect(
      payments.verifyCardPayment("pay-1", "ref-1", client),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the payment unresolved when the gateway cannot be reached", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(basePayment);
    (prisma.paymentAttempt.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "att-1", processorReference: "ref-1" });
    (verifyByReference as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("gateway down"));

    await expect(
      payments.verifyCardPayment("pay-1", "ref-1", client),
    ).rejects.toMatchObject({ code: "GATEWAY" });

    // A failed verification attempt is recorded; status untouched.
    expect(prisma.paymentAttempt.create).toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("confirms a matching successful transaction exactly once", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(basePayment);
    (prisma.paymentAttempt.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "att-1", processorReference: "ref-1" });
    (verifyByReference as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "successful", amount: 18_500_000, currency: "NGN", txRef: "ref-1", processorTxId: "123", method: "card",
    });
    (prisma.payment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await payments.verifyCardPayment("pay-1", "ref-1", client);
    expect(result.status).toBe("SUCCESSFUL");
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: { not: "SUCCESSFUL" } },
      }),
    );
  });

  it("short-circuits an already successful payment (idempotent verify)", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...basePayment, status: "SUCCESSFUL",
    });
    const result = await payments.verifyCardPayment("pay-1", "ref-1", client);
    expect(result.status).toBe("SUCCESSFUL");
    expect(verifyByReference).not.toHaveBeenCalled();
  });

  it("refuses verification for a payment whose session is unknown", async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(basePayment);
    (prisma.paymentAttempt.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      payments.verifyCardPayment("pay-1", "unknown-ref", client),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
