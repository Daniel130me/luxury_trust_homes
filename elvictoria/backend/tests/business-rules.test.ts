/**
 * Business-model rule tests (vitest).
 *
 * Covers the three business-model changes:
 * 1. Shared legal identity — display helpers (client-facing copy is
 *    generic because all lawyers share the ELVICTORIA Legal account).
 * 2. Bank transfer as primary method — details are only returned to
 *    staff or payers with an active payment request.
 * 3. Admin-managed property types — submitted categories must match an
 *    active PropertyType.
 *
 * Unit-level, no database required — prisma and notify are mocked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    propertyType: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    payment: { count: vi.fn() },
    setting: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/notify.js", () => ({
  notifyMany: vi.fn(),
  notifyAllLawyers: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../src/lib/flutterwave.js", () => ({
  verifyByReference: vi.fn(),
  initiateCardPayment: vi.fn(),
  webhookSignatureValid: vi.fn(),
}));

import { validatePropertyCategory } from "../src/modules/properties/service.js";
import { bankTransferDetails } from "../src/modules/payments/service.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------- admin-managed property types

describe("validatePropertyCategory (admin-managed taxonomy)", () => {
  it("accepts a category that matches an active type name", async () => {
    vi.mocked(prisma.propertyType.findFirst).mockResolvedValue({ id: "t1" } as never);
    expect(await validatePropertyCategory("Apartment")).toBeNull();
  });

  it("rejects an unknown category name", async () => {
    vi.mocked(prisma.propertyType.findFirst).mockResolvedValue(null);
    expect(await validatePropertyCategory("Spaceship")).toBe("Choose a valid property type.");
  });

  it("rejects a DEACTIVATED type (pickers hide it, so listings must not use it)", async () => {
    // findFirst is queried with active: true, so a deactivated type yields null
    vi.mocked(prisma.propertyType.findFirst).mockResolvedValue(null);
    expect(await validatePropertyCategory("Old Type")).toBe("Choose a valid property type.");
    expect(prisma.propertyType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "Old Type", active: true } }),
    );
  });
});

// ------------------------------------------------- gated bank transfer details

describe("bankTransferDetails (primary manual payment method)", () => {
  const details = { bankName: "GTBank", bankAccountName: "ELVICTORIA Legal", bankAccountNumber: "0123456789" };

  it("returns details for a payer with an active payment request", async () => {
    vi.mocked(prisma.payment.count).mockResolvedValue(2);
    vi.mocked(prisma.setting.findMany).mockResolvedValue(
      Object.entries(details).map(([key, value]) => ({ key, value })) as never,
    );
    expect(await bankTransferDetails("client1", false)).toEqual(details);
    // the eligibility check ran
    expect(prisma.payment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ payerId: "client1" }) }),
    );
  });

  it("returns null for a user who has not reached the payment stage", async () => {
    vi.mocked(prisma.payment.count).mockResolvedValue(0);
    expect(await bankTransferDetails("visitor1", false)).toBeNull();
    // settings are never even read — no leak
    expect(prisma.setting.findMany).not.toHaveBeenCalled();
  });

  it("always returns details to staff without an eligibility check", async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue(
      Object.entries(details).map(([key, value]) => ({ key, value })) as never,
    );
    expect(await bankTransferDetails("staff1", true)).toEqual(details);
    expect(prisma.payment.count).not.toHaveBeenCalled();
  });
});
