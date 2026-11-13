import { Router, type Request } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { validate, emailSchema, passwordSchema, phoneSchema } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { prisma } from "../../lib/prisma.js";
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
    ok(res, { user }, 201);
  },
);

router.post(
  "/login",
  authLimiter,
  validate({
    body: z.object({
      email: emailSchema,
      password: z.string().min(1, "Enter your password."),
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
    req.cookies?.["ev_refresh"] as string | undefined,
    res,
    requestContext(req),
  );
  ok(res, { user });
});

router.post("/logout", async (req, res) => {
  await svc.logout(req.cookies?.["ev_refresh"] as string | undefined, res);
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
    body: z.object({ token: z.string().min(10), password: passwordSchema }),
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
      current: z.string().min(1, "Enter your current password."),
      password: passwordSchema,
    }),
  }),
  async (req, res) => {
    await svc.changePassword(req.user!.id, req.body.current, req.body.password);
    ok(res, { message: "Your password has been changed." });
  },
);

export default router;
