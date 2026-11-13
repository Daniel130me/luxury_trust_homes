import { Router } from "express";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, phoneSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/notify.js";
import { revokeAllSessions } from "../auth/service.js";

/**
 * Users module:
 * - self-service profile (own data only)
 * - staff user management (user.viewAll / user.manage)
 * - provider access requests shown on the staff dashboard
 */

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema,
  organisation: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  preferredState: z.string().trim().max(40).optional().or(z.literal("")),
  preferredRegion: z.string().trim().max(40).optional().or(z.literal("")),
  alertsEnabled: z.boolean().optional(),
});

/** PATCH /users/me — update own profile details. */
router.patch("/me", requireAuth, validate({ body: updateProfileSchema }), async (req, res) => {
  const data = { ...req.body };
  for (const key of Object.keys(data)) {
    if (data[key] === "" || data[key] === undefined) delete data[key];
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      providerKind: true, organisation: true, city: true,
      preferredState: true, preferredRegion: true, alertsEnabled: true,
    },
  });
  ok(res, { user });
});

/**
 * GET /users (staff, user.viewAll)
 * Search + role filter + pagination. Contact details are visible to staff.
 */
router.get("/", requirePermission("user.viewAll"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
  const search = String(req.query.search ?? "").trim();
  const role = String(req.query.role ?? "").toUpperCase();

  const where = {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { organisation: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {},
      ["LAWYER", "SUPPORT", "PROVIDER", "CLIENT"].includes(role)
        ? { role: role as never }
        : {},
    ],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        status: true, providerKind: true, organisation: true, city: true,
        registeredAt: true, lastActiveAt: true,
        _count: { select: { properties: true } },
      },
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  ok(res, { users, total, page, pageSize, pages: Math.ceil(total / pageSize) });
});

/** GET /users/:id (staff) — full profile with activity summary. */
router.get("/:id", requirePermission("user.viewAll"), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true,
      providerKind: true, clientKind: true, organisation: true, city: true,
      preferredState: true, preferredRegion: true, interest: true,
      registeredAt: true, lastActiveAt: true,
      _count: {
        select: { properties: true, clientCases: true, assignedCases: true, tickets: true },
      },
    },
  });
  if (!user) throw ApiError.notFound("User not found.");
  ok(res, { user });
});

/**
 * PATCH /users/:id/status (user.manage) — activate / deactivate accounts.
 * Deactivation revokes sessions immediately; the user also loses access on
 * the next request because attachUser checks status.
 */
router.patch(
  "/:id/status",
  requirePermission("user.manage"),
  validate({ body: z.object({ status: z.enum(["ACTIVE", "DEACTIVATED"]) }) }),
  async (req, res) => {
    const id = String(req.params.id);
    if (id === req.user!.id) {
      throw ApiError.badRequest("You cannot deactivate your own account.");
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound("User not found.");
    if (target.role === "LAWYER") {
      throw ApiError.forbidden("Lawyer accounts are managed outside the platform.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status: req.body.status },
      select: { id: true, status: true },
    });
    if (req.body.status === "DEACTIVATED") await revokeAllSessions(id);

    await audit({
      actorId: req.user!.id,
      action: "user.status_change",
      entityType: "User",
      entityId: id,
      meta: { status: req.body.status },
      ip: req.ip,
    });
    ok(res, { user });
  },
);

/**
 * GET /users/access-requests (staff) — provider accounts pending access
 * grants (prototype: "access requests" panel on the staff dashboard).
 */
router.get("/access-requests/list", requirePermission("user.viewAll"), async (_req, res) => {
  // Access requests in the prototype are provider sign-ups awaiting staff
  // review; here that equals providers created in the last 30 days that
  // have no approved listings yet.
  const since = new Date(Date.now() - 30 * 86400_000);
  const providers = await prisma.user.findMany({
    where: { role: "PROVIDER", registeredAt: { gte: since }, properties: { none: {} } },
    select: { id: true, name: true, email: true, registeredAt: true, organisation: true },
    orderBy: { registeredAt: "desc" },
  });
  ok(res, { requests: providers });
});

export default router;
