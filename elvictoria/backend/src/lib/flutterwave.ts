import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Flutterwave API v3 client (test environment during development).
 *
 * Only the backend talks to Flutterwave. Payment confirmation always happens
 * server-side via the verify endpoint — a redirect or callback alone is
 * never trusted (see modules/payments/service.ts).
 */

const BASE_URL = "https://api.flutterwave.com/v3";

type FlwInitiateResponse = {
  status: string;
  message: string;
  data?: { link?: string };
};

type FlwVerifyResponse = {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type?: string;
    created_at?: string;
  };
};

/** Give up on a gateway call after this long instead of hanging the request. */
const FLW_TIMEOUT_MS = 15_000;

async function flwFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FLW_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message || `Flutterwave request failed (${res.status})`);
  }
  return body;
}

export type InitiatePaymentInput = {
  txRef: string;
  amount: number; // naira
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  redirectUrl: string;
  description: string;
};

/**
 * Create a hosted checkout session and return the payment link.
 * Uses the Standard flow: works with just the secret key.
 */
export async function initiateCardPayment(
  input: InitiatePaymentInput,
): Promise<{ link: string }> {
  const res = await flwFetch<FlwInitiateResponse>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amount,
      currency: "NGN",
      payment_options: "card,banktransfer",
      redirect_url: input.redirectUrl,
      customer: {
        email: input.customerEmail,
        name: input.customerName,
        phonenumber: input.customerPhone || undefined,
      },
      customizations: {
        title: "Luxury Trust Homes",
        description: input.description,
      },
    }),
  });
  if (res.status !== "success" || !res.data?.link) {
    throw new Error(res.message || "Could not start the payment session.");
  }
  return { link: res.data.link };
}

export type VerifyResult = {
  status: "successful" | "failed" | "pending";
  amount: number;
  currency: string;
  txRef: string;
  processorTxId: string;
  method: string;
};

/**
 * Verify a transaction by reference, straight from our backend.
 * The result must match the expected amount, currency and status before a
 * payment is confirmed.
 */
export async function verifyByReference(txRef: string): Promise<VerifyResult> {
  const res = await flwFetch<FlwVerifyResponse>(
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
  );

  if (res.status !== "success" || !res.data) {
    throw new Error(res.message || "Could not verify the transaction.");
  }

  const raw = res.data.status;
  const status =
    raw === "successful"
      ? ("successful" as const)
      : raw === "pending" || raw === "abandoned" || raw === "re-entrant"
        ? ("pending" as const)
        : ("failed" as const);

  return {
    status,
    amount: res.data.amount,
    currency: res.data.currency,
    txRef: res.data.tx_ref,
    processorTxId: String(res.data.id),
    method: res.data.payment_type ?? "card",
  };
}

/**
 * Validate the webhook signature header ("verif-hash").
 * Returns false while FLW_WEBHOOK_SECRET is unset (documented follow-up).
 */
export function webhookSignatureValid(header: string | undefined): boolean {
  if (!env.FLW_WEBHOOK_SECRET || !header) return false;
  // Constant-time comparison so the secret cannot be guessed byte by byte
  // from response timing.
  const expected = Buffer.from(env.FLW_WEBHOOK_SECRET);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
