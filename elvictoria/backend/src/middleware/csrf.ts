import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors.js";
import { isProd } from "../config/env.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { CSRF_COOKIE } from "./cookies.js";

/**
 * CSRF protection for cookie-authenticated mutations (double-submit pattern).
 *
 * - A readable `ev_csrf` cookie holds a random token (set at login/refresh).
 * - Every mutating request must send the same value in the `X-CSRF-Token`
 *   header; the browser same-origin policy stops other sites from reading
 *   the cookie, and the SameSite=Strict cookie blocks most cross-site sends.
 * - The token is also compared using a constant-time equality check.
 *
 * Safe methods (GET/HEAD/OPTIONS) and the refresh endpoint are exempt.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// CSRF-exempt endpoints:
// - pre-session auth bootstrap (login/register/reset) — protected by rate
//   limiting instead; no authenticated session exists to forge yet.
//   change-password stays protected (it requires a live session).
// - the onboarding-wizard draft and the public contact form: used by
//   anonymous visitors who have no CSRF cookie yet. Neither acts on a
//   session (the handlers never read req.user), and both are rate limited.
// - /payments/webhook authenticates with the Flutterwave signature header.
const CSRF_EXEMPT_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/signup-draft",
  "/contact",
  "/payments/webhook",
  "/health",
]);

export function issueCsrfToken(res: Response): string {
  const token = randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by the SPA (double-submit pattern)
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
  });
  return token;
}

function tokensMatch(headerValue: string | undefined, cookieValue: string | null) {
  if (!headerValue || !cookieValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(cookieValue);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  // This middleware runs before the /api router, so strip the prefix to
  // compare against route paths.
  const path = req.path.replace(/^\/api/, "");
  // Express matches routes case-insensitively and ignores a trailing
  // slash, so normalise the same way before the exemption lookup.
  const normalised = path.toLowerCase().replace(/\/+$/, "") || "/";
  if (CSRF_EXEMPT_PATHS.has(normalised)) return next();

  if (!tokensMatch(req.headers["x-csrf-token"] as string | undefined, req.csrfToken)) {
    return next(new ApiError(403, "CSRF", "Missing or invalid CSRF token."));
  }
  next();
}
