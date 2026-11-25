import { Router, type Request } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { validate, emailSchema, passwordSchema, phoneSchema, PASSWORD_MAX_LENGTH } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { prisma } from "../../lib/prisma.js";
import { isProd } from "../../config/env.js";
import { REFRESH_COOKIE, SIGNUP_DRAFT_COOKIE } from "../../middleware/cookies.js";
import * as svc from "./service.js";

/**
 * Auth routes: register, login, refresh, logout, password flows.
 * All endpoints are rate limited; responses never leak whether an
 * account exists.
 */
const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  accountType: z.enum(["client", "provider"]),
  providerKind: z.enum(["OWNER", "DEVELOPER", "AGENT"]).optional(),
  organisation: z.string().trim().max(120).optional().or(z.literal("")),
  interest: z.enum(["BUYING", "RENTING", "SELLING", "BROWSING"]).optional(),
  clientKind: z.enum(["BUYER", "RENTER", "BROWSING"]).optional(),
  preferredState: z.string().trim().max(40).optional().or(z.literal("")),
  preferredRegion: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
});

const requestContext = (req: Request) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});

router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  async (req, res) => {
    const user = await svc.register(req.body, res, requestContext(req));
    // Onboarding complete — drop the persisted wizard draft (row + cookie).
    const draftToken = req.cookies?.[SIGNUP_DRAFT_COOKIE] as string | undefined;
    if (draftToken) {
      await svc.clearSignupDraft(draftToken);
      res.clearCookie(SIGNUP_DRAFT_COOKIE, { path: "/" });
    }
    ok(res, { user }, 201);
  },
);

// -------------------------------------------------------- signup draft
//
// Persistence for the onboarding wizard: each completed step is merged into
// a SignupDraft row keyed by an httpOnly cookie, so the visitor can refresh
// or leave and resume exactly where they stopped. Anonymous by design —
// CSRF-exempt (see middleware/csrf.ts) and covered by the rate limiter;
// drafts hold no secrets and are deleted on successful registration.

const DRAFT_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const draftDataSchema = z.object({
  interest: z.string().trim().max(20).optional(),
  clientKind: z.string().trim().max(20).optional(),
  providerKind: z.string().trim().max(20).optional(),
  organisation: z.string().trim().max(120).optional(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  preferredState: z.string().trim().max(40).optional(),
  preferredRegion: z.string().trim().max(40).optional(),
});

router.get("/signup-draft", async (req, res) => {
  const draft = await svc.findSignupDraft(req.cookies?.[SIGNUP_DRAFT_COOKIE] as string | undefined);
  ok(res, { draft });
});

router.put(
  "/signup-draft",
  validate({
    body: z.object({
      step: z.coerce.number().int().min(1).max(3),
      role: z.enum(["client", "provider"]).nullable().optional(),
      data: draftDataSchema.optional(),
    }),
  }),
  async (req, res) => {
    const { step, role, data } = req.body as {
      step: number;
      role?: "client" | "provider" | null;
      data?: svc.SignupDraftData;
    };
    const token = req.cookies?.[SIGNUP_DRAFT_COOKIE] as string | undefined;
    const draft = await svc.saveSignupDraft(token, (value) => res.cookie(SIGNUP_DRAFT_COOKIE, value, DRAFT_COOKIE_OPTS), {
      step,
      role: role ?? null,
      data: data ?? {},
    });
    ok(res, { draft });
  },
);

router.delete("/signup-draft", async (req, res) => {
  await svc.clearSignupDraft(req.cookies?.[SIGNUP_DRAFT_COOKIE] as string | undefined);
  res.clearCookie(SIGNUP_DRAFT_COOKIE, { path: "/" });
  ok(res, { cleared: true });
});

router.post(
  "/login",
  authLimiter,
  validate({
    body: z.object({
      email: emailSchema,
      password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
    }),
  }),
  async (req, res) => {
    const user = await svc.login(
      req.body.email,
      req.body.password,
      res,
      requestContext(req),
    );
    ok(res, { user });
  },
);

// CSRF exempt (bootstrap endpoint) — see middleware/csrf.ts.
router.post("/refresh", async (req, res) => {
  const user = await svc.refresh(
    req.cookies?.[REFRESH_COOKIE] as string | undefined,
    res,
    requestContext(req),
  );
  ok(res, { user });
});

router.post("/logout", async (req, res) => {
  await svc.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined, res);
  ok(res, { signedOut: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      providerKind: true,
      clientKind: true,
      interest: true,
      organisation: true,
      city: true,
      preferredState: true,
      preferredRegion: true,
      alertsEnabled: true,
      registeredAt: true,
      lastActiveAt: true,
    },
  });
  ok(res, { user });
});

router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: z.object({ email: emailSchema }) }),
  async (req, res) => {
    await svc.requestPasswordReset(req.body.email);
    ok(res, {
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  },
);

router.post(
  "/reset-password",
  authLimiter,
  validate({
    body: z.object({ token: z.string().min(10).max(200), password: passwordSchema }),
  }),
  async (req, res) => {
    await svc.resetPassword(req.body.token, req.body.password);
    ok(res, { message: "Your password has been updated. You can now sign in." });
  },
);

router.post(
  "/change-password",
  authLimiter,
  requireAuth,
  validate({
    body: z.object({
      current: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX_LENGTH),
      password: passwordSchema,
    }),
  }),
  async (req, res) => {
    await svc.changePassword(req.user!.id, req.body.current, req.body.password, res, requestContext(req));
    ok(res, { message: "Your password has been changed." });
  },
);

export default router;
