import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../lib/errors.js";
import type { AuthUser } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { ACCESS_COOKIE, CSRF_COOKIE } from "./cookies.js";

/**
 * Authentication middleware.
 *
 * The access token is a short-lived JWT stored in an HTTP-only cookie. We
 * attach the full AuthUser to the request for every authenticated call.
 * Role/permission checks happen separately (middleware/rbac.ts + services).
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: AuthUser | null;
      csrfToken: string | null;
    }
  }
}

export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.user = null;
  req.csrfToken = (req.cookies?.[CSRF_COOKIE] as string) ?? null;

  const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        providerKind: true,
        organisation: true,
      },
    });
    // Deactivated accounts lose access immediately.
    req.user = user && user.status === "ACTIVE" ? (user as AuthUser) : null;
    next();
  } catch (err) {
    // An invalid or expired token means "anonymous" — the refresh flow takes
    // it from there. Any other failure (DB unreachable, a suspended Neon
    // compute timing out) must NOT masquerade as an auth failure: that made
    // every transient hiccup a 401 and bounced users to /login in a loop.
    // Infrastructure errors propagate to the error handler (500) so clients
    // keep their session and retry.
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      req.user = null;
      next();
    } else {
      next(err);
    }
  }
}

/** Require a signed-in, active user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) next(ApiError.unauthorized());
  else next();
}

/** Require one of the given permissions (staff capabilities). */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    const { can } = require("../lib/permissions.js") as typeof import("../lib/permissions.js");
    const allowed = permissions.some((p) => can(req.user, p));
    if (!allowed) next(ApiError.forbidden());
    else next();
  };
}
