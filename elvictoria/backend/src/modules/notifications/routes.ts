import { Router } from "express";
import { z } from "zod";

import { validate, paginationQuery } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { ok } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Notifications: list (paginated), unread count, mark read.
 */
const router = Router();

const listQuery = paginationQuery(20).extend({
  unread: z.enum(["true", "false"]).optional(),
});

router.get("/", requireAuth, validate({ query: listQuery }), async (req, res) => {
  const { page, pageSize, unread: unreadParam } = req.validated!.query as z.infer<typeof listQuery>;
  const unreadOnly = unreadParam === "true";

  const where = {
    userId: req.user!.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [total, notifications, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  ok(res, { notifications, total, page, pageSize, pages: Math.ceil(total / pageSize), unread });
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const unread = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });
  ok(res, { unread });
});

router.post(
  "/mark-read",
  requireAuth,
  validate({ body: z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(100) }) }),
  async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { id: { in: req.body.ids }, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    // Report what actually changed (foreign or already-read ids are skipped).
    ok(res, { marked: result.count });
  },
);

router.post("/mark-all-read", requireAuth, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  ok(res, { marked: result.count });
});

export default router;
