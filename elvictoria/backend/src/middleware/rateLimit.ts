import rateLimit from "express-rate-limit";

/**
 * Rate limiting.
 *
 * Strict limits protect authentication and payment endpoints from brute
 * force and abuse; a general limiter keeps accidental request floods from
 * overwhelming the database. Limits are per IP; behind the sandbox gateway
 * the real client IP arrives via X-Forwarded-For (trust proxy enabled).
 */

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts. Please wait a few minutes and try again.",
    },
  },
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: "RATE_LIMITED", message: "Too many payment attempts. Please wait a minute and try again." },
  },
});

/**
 * Anonymous public forms (contact form, ticket tracking). Every contact
 * submission notifies all lawyers, and ticket tracking takes a reference +
 * email pair, so both need a tight per-IP budget against spam and
 * enumeration.
 */
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many submissions. Please wait a few minutes and try again.",
    },
  },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
