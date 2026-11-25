import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/errors.js";
import { env, isProd } from "../../config/env.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../../middleware/cookies.js";
import { issueCsrfToken } from "../../middleware/csrf.js";
import { CSRF_COOKIE } from "../../middleware/cookies.js";
import { notifyMany } from "../../lib/notify.js";
import type { AuthUser } from "../../lib/permissions.js";

/**
 * Authentication service.
 *
 * Session model:
 * - Access token: short-lived JWT in an HTTP-only cookie (stateless).
 * - Refresh token: opaque random token; only its SHA-256 hash is stored,
 *   so a database leak cannot be replayed. Sessions can be revoked.
 * - Passwords: bcrypt with 10 rounds.
 */

const BCRYPT_ROUNDS = 10;

/** Password reset links stay valid for one hour. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Refresh-token reuse grace window. Two browser tabs (or two parallel
 * requests) that refresh at the same moment both present the same token;
 * the second one finds it already rotated. Inside this window that is
 * treated as a benign race (plain 401 — the browser already holds the new
 * cookies from the winner) instead of a stolen-token replay that revokes
 * every session of the user.
 */
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

/**
 * Pre-computed bcrypt hash compared against when the email is unknown, so
 * a login for a non-existent account costs the same time as a wrong
 * password and response timing cannot be used to enumerate accounts.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", BCRYPT_ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const base = {
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
  };
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    httpOnly: true,
    maxAge: env.JWT_ACCESS_TTL * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Create a session row and set all auth cookies (access + refresh + csrf). */
async function startSession(
  userId: string,
  res: Response,
  context: { ip?: string; userAgent?: string },
): Promise<void> {
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86400_000),
      ip: context.ip ?? null,
      userAgent: context.userAgent?.slice(0, 200) ?? null,
    },
  });
  setAuthCookies(res, signAccessToken(userId), refreshToken);
  issueCsrfToken(res);
}

export async function clearSession(res: Response): Promise<void> {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}

// ------------------------------------------------------------- register

export type RegisterInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  accountType: "client" | "provider";
  providerKind?: "OWNER" | "DEVELOPER" | "AGENT";
  organisation?: string;
  interest?: "BUYING" | "RENTING" | "SELLING" | "BROWSING";
  clientKind?: "BUYER" | "RENTER" | "BROWSING";
  preferredState?: string;
  preferredRegion?: string;
  city?: string;
};

export async function register(
  input: RegisterInput,
  res: Response,
  context: { ip?: string; userAgent?: string },
): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.badRequest("Please check the highlighted fields.", {
      email: "That email is already used by another account.",
    });
  }

  const passwordHash = await hashPassword(input.password);
  const isProvider = input.accountType === "provider";

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone || null,
      passwordHash,
      role: isProvider ? "PROVIDER" : "CLIENT",
      providerKind: isProvider ? (input.providerKind ?? "OWNER") : null,
      clientKind: isProvider ? null : (input.clientKind ?? "BUYER"),
      interest: isProvider ? "SELLING" : (input.interest ?? "BUYING"),
      organisation: input.organisation?.trim() || null,
      city: input.city?.trim() || input.preferredState || null,
      preferredState: input.preferredState || null,
      preferredRegion: input.preferredRegion || null,
      alertsEnabled: !isProvider,
      termsAcceptedAt: new Date(),
    },
    select: { id: true, name: true, email: true, role: true, status: true, providerKind: true, organisation: true },
  });

  await notifyMany([
    {
      userId: user.id,
      category: "account",
      title: isProvider
        ? "Your provider account is ready."
        : "Your account is ready.",
      body: isProvider
        ? "You can now add listings and submit them to our legal team for review."
        : "Browse properties and submit enquiries through our legal team.",
      link: isProvider ? "/app/provider" : "/app/client",
    },
  ]);

  await startSession(user.id, res, context);
  return user as AuthUser;
}

// ---------------------------------------------------------------- login

export async function login(
  email: string,
  password: string,
  res: Response,
  context: { ip?: string; userAgent?: string },
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Same generic message — and the same bcrypt cost — for an unknown email
  // and a wrong password.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "The email or password you entered is incorrect.",
    );
  }
  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden(
      "This account has been deactivated. Please contact Elvictoria support.",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  await startSession(user.id, res, context);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    providerKind: user.providerKind,
    organisation: user.organisation,
  } satisfies AuthUser;
}

// -------------------------------------------------------------- refresh

/**
 * Rotate the refresh token. The presented token is revoked and replaced.
 * A valid token that is not found in the database means it was already
 * used/rotated — the session is treated as compromised and every session
 * for the user is revoked (reuse detection).
 */
export async function refresh(
  presentedToken: string | undefined,
  res: Response,
  context: { ip?: string; userAgent?: string },
): Promise<AuthUser> {
  if (!presentedToken) throw ApiError.unauthorized("Session expired. Please sign in again.");

  const tokenHash = sha256(presentedToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    await clearSession(res);
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
  if (session.revokedAt) {
    // A just-rotated token is a concurrent refresh (another tab won the
    // race), not an attack — reject it without touching other sessions.
    const revokedRecently = Date.now() - session.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
    if (!revokedRecently) {
      // Refresh token replay — revoke everything for this user.
      await revokeAllSessions(session.userId);
      await clearSession(res);
    }
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
  if (session.user.status !== "ACTIVE") {
    await clearSession(res);
    throw ApiError.forbidden(
      "This account has been deactivated. Please contact Elvictoria support.",
    );
  }

  // Claim the presented token atomically: of two concurrent refreshes only
  // one may rotate it, otherwise both would mint a new session.
  const newRefreshToken = randomBytes(48).toString("base64url");
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claim.count === 0) return false;
    await tx.session.create({
      data: {
        userId: session.userId,
        tokenHash: sha256(newRefreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86400_000),
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 200) ?? null,
      },
    });
    return true;
  });
  if (!claimed) {
    // Lost the race to a parallel refresh: the winner already set cookies.
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }

  setAuthCookies(res, signAccessToken(session.userId), newRefreshToken);
  issueCsrfToken(res);

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    status: session.user.status,
    providerKind: session.user.providerKind,
    organisation: session.user.organisation,
  };
}

// --------------------------------------------------------------- logout

export async function logout(
  presentedToken: string | undefined,
  res: Response,
): Promise<void> {
  if (presentedToken) {
    const tokenHash = sha256(presentedToken);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSession(res);
}

// ------------------------------------------------------ password resets

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Always return success: never reveal whether an account exists.
  if (!user || user.status !== "ACTIVE") return;

  const token = randomBytes(32).toString("base64url");
  // Only the newest link works: older unused links for the account are
  // invalidated so a leaked earlier email cannot be used later.
  await prisma.$transaction([
    prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  // NON-STANDARD: email delivery is not configured yet, so the reset link
  // is written to the server log in development only. Replace with an email
  // service (e.g. Resend/SES) before production.
  if (env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[dev] Password reset link for ${user.email}: ${link}`);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = sha256(token);
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    // Conditional claim: two concurrent submissions of the same link must
    // not both succeed (single-use guarantee).
    const claim = await tx.passwordReset.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      throw ApiError.badRequest("This reset link is invalid or has expired. Please request a new one.");
    }
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    // Password change invalidates every existing session.
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  res: Response,
  context: { ip?: string; userAgent?: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest("Please check the highlighted fields.", {
      current: "Your current password is incorrect.",
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  // Every other device is signed out; this one continues on a fresh
  // session instead of being logged out when its access token expires.
  await startSession(userId, res, context);
}

/** Revoke every refresh token (used when staff deactivate an account). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------- signup draft
//
// Onboarding wizard persistence: an anonymous visitor answers the wizard
// step by step; every completed step is merged into a SignupDraft row keyed
// by an httpOnly cookie token, so refreshing or closing the tab never loses
// progress and no half-finished User rows are created. The password is
// deliberately NOT persisted — only non-secret profile fields.

export type SignupDraftRole = "client" | "provider";

export type SignupDraftData = {
  interest?: string;
  clientKind?: string;
  providerKind?: string;
  organisation?: string;
  name?: string;
  email?: string;
  phone?: string;
  preferredState?: string;
  preferredRegion?: string;
};

export type SignupDraft = {
  step: number;
  role: SignupDraftRole | null;
  data: SignupDraftData;
};

function randomDraftToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function findSignupDraft(
  token: string | undefined,
): Promise<SignupDraft | null> {
  if (!token) return null;
  const row = await prisma.signupDraft.findUnique({
    where: { token },
    select: { step: true, role: true, data: true },
  });
  if (!row) return null;
  return {
    step: row.step,
    role: (row.role as SignupDraftRole | null) ?? null,
    data: (row.data as SignupDraftData) ?? {},
  };
}

export async function saveSignupDraft(
  token: string | undefined,
  setCookie: (value: string) => void,
  input: { step: number; role?: SignupDraftRole | null; data: SignupDraftData },
): Promise<SignupDraft> {
  // The token lives in the cookie; generate one on first save.
  const draftToken = token ?? randomDraftToken();
  if (!token) setCookie(draftToken);

  const existing = await prisma.signupDraft.findUnique({ where: { token: draftToken } });
  // Merge — later steps extend, never wipe, earlier answers.
  const mergedData: SignupDraftData = {
    ...((existing?.data as SignupDraftData) ?? {}),
    ...input.data,
  };
  const role = input.role ?? (existing?.role as SignupDraftRole | null) ?? null;

  const row = await prisma.signupDraft.upsert({
    where: { token: draftToken },
    create: { token: draftToken, step: input.step, role, data: mergedData },
    update: { step: input.step, role, data: mergedData },
    select: { step: true, role: true, data: true },
  });
  return {
    step: row.step,
    role: (row.role as SignupDraftRole | null) ?? null,
    data: (row.data as SignupDraftData) ?? {},
  };
}

export async function clearSignupDraft(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.signupDraft.deleteMany({ where: { token } });
}

