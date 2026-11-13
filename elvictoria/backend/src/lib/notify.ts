import { prisma } from "./prisma.js";

/**
 * Notifications + audit log helpers.
 *
 * `notifyMany` fans out a notification to several users (e.g. every lawyer
 * when a new enquiry arrives). Failures here must never break the main
 * operation — notifications are best-effort and always run in a separate
 * round trip after the transaction commits.
 */

type NotifyInput = {
  userId: string;
  category:
    | "new_enquiry"
    | "payment_success"
    | "payment_failure"
    | "property_submission"
    | "admin_alert"
    | "case_update"
    | "account";
  title: string;
  body: string;
  link?: string;
};

export async function notifyMany(items: NotifyInput[]): Promise<void> {
  if (items.length === 0) return;
  await prisma.notification.createMany({
    data: items.map((i) => ({
      userId: i.userId,
      category: i.category,
      title: i.title,
      body: i.body,
      link: i.link,
    })),
  });
}

/** Notify every active lawyer (used for enquiries, escalations, fraud). */
export async function notifyAllLawyers(items: Omit<NotifyInput, "userId">[]) {
  const lawyers = await prisma.user.findMany({
    where: { role: "LAWYER", status: "ACTIVE" },
    select: { id: true },
  });
  await notifyMany(lawyers.map((l) => items.map((i) => ({ ...i, userId: l.id }))).flat());
}

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

/** Persist an audit trail entry. Best-effort, never throws. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: (input.meta ?? undefined) as never,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // Auditing must not break the business operation.
  }
}
