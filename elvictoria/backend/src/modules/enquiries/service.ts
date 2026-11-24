import { ContactMethod, EnquiryStatus, Prisma, Purpose, Thread, Visibility } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/errors.js";
import { can, type AuthUser } from "../../lib/permissions.js";
import { notifyMany, notifyAllLawyers, audit } from "../../lib/notify.js";
import { nextReference } from "../../lib/references.js";

/**
 * Enquiries & transaction cases.
 *
 * Business model (from the prototype): a buyer/renter submits an enquiry on
 * a listed property. It lands directly in progress with the least-loaded
 * active lawyer assigned — there is no "waiting to be taken up" stage — and
 * any lawyer can open the transaction case; all further contact between
 * client and provider runs through the lawyer. Clients and providers never
 * see each other's contact details until the lawyer authorises a disclosure,
 * and internal notes are never visible to participants.
 */

const OPEN_STATUSES: EnquiryStatus[] = [
  "IN_PROGRESS", "NEGOTIATION", "PAYMENT_PENDING",
];

// ------------------------------------------------------------- create

export type CreateEnquiryInput = {
  propertyId: string;
  purpose: Purpose;
  contactMethod: ContactMethod;
  message: string;
};

export async function createEnquiry(
  client: AuthUser,
  input: CreateEnquiryInput,
  ip?: string,
) {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true, reference: true, title: true, providerId: true, status: true, availability: true },
  });
  if (!property || property.status !== "APPROVED" || property.availability === "UNAVAILABLE") {
    throw ApiError.notFound("Property not found.");
  }
  if (property.providerId === client.id) {
    throw ApiError.badRequest("You cannot enquire about your own listing.");
  }

  // One active enquiry per property per client.
  const existing = await prisma.enquiry.findFirst({
    where: {
      propertyId: property.id,
      clientId: client.id,
      status: { in: OPEN_STATUSES },
    },
    select: { reference: true },
  });
  if (existing) {
    throw ApiError.conflict(
      `You already have an active enquiry for this property (${existing.reference}).`,
    );
  }

  // Pick the active lawyer carrying the fewest open enquiries so the matter
  // is genuinely in progress from the moment it lands. If none is active the
  // enquiry still moves forward unassigned and the lawyer opening the case
  // takes it over (see openCase).
  const lawyerLoad = await prisma.enquiry.groupBy({
    by: ["lawyerId"],
    where: {
      lawyerId: { not: null },
      status: { in: ["IN_PROGRESS", "NEGOTIATION", "PAYMENT_PENDING"] },
    },
    _count: { lawyerId: true },
  });
  const activeLawyers = await prisma.user.findMany({
    where: { role: "LAWYER", status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const openCount = new Map(
    lawyerLoad.map((row) => [row.lawyerId as string, row._count.lawyerId]),
  );
  const assignedLawyer =
    activeLawyers.sort((a, b) => (openCount.get(a.id) ?? 0) - (openCount.get(b.id) ?? 0))[0] ??
    null;

  // Allocate the reference and create the enquiry atomically.
  const enquiry = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx as never, "enquiry");
    return tx.enquiry.create({
      data: {
        reference,
        propertyId: property.id,
        clientId: client.id,
        purpose: input.purpose,
        contactMethod: input.contactMethod,
        message: input.message.trim(),
        lawyerId: assignedLawyer?.id ?? null,
        status: EnquiryStatus.IN_PROGRESS,
      },
    });
  });

  // The opening message becomes the first CLIENT thread entry when a lawyer
  // opens the case (see openCase). Until then it lives on the enquiry itself.

  const clientName = client.name;
  await notifyAllLawyers([
    {
      category: "new_enquiry",
      title: "New property enquiry",
      body: `${clientName} enquired about ${property.reference} — ${property.title}.`,
      link: `/app/staff/matters/${enquiry.id}`,
    },
  ]);
  if (assignedLawyer) {
    await notifyMany([
      {
        userId: assignedLawyer.id,
        category: "case_update",
        title: "Enquiry assigned to you",
        body: `You are handling ${enquiry.reference} — ${property.title}.`,
        link: `/app/staff/matters/${enquiry.id}`,
      },
    ]);
  }
  // The client must never get the impression the request sits in a queue:
  // confirm immediately that it is already in progress.
  await notifyMany([
    {
      userId: client.id,
      category: "case_update",
      title: "Your request is in progress",
      body: assignedLawyer
        ? `${assignedLawyer.name} is handling your enquiry about ${property.reference} — ${property.title}. We will keep you updated here.`
        : `Our team is handling your enquiry about ${property.reference} — ${property.title}. We will keep you updated here.`,
      link: `/app/client/enquiries/${enquiry.id}`,
    },
  ]);
  await audit({
    actorId: client.id,
    action: "enquiry.create",
    entityType: "Enquiry",
    entityId: enquiry.id,
    meta: { property: property.reference, lawyerId: assignedLawyer?.id ?? null },
    ip,
  });
  return enquiry;
}

// -------------------------------------------------------------- staff

/**
 * Staff enquiry list. Views mirror the prototype tabs:
 * all | attention | unassigned | escalated (+ optional status filter).
 */
export async function listForStaff(
  _actor: AuthUser,
  filters: {
    page: number;
    pageSize: number;
    view?: string;
    status?: string;
    search?: string;
  },
) {
  const where: Prisma.EnquiryWhereInput = {};
  if (filters.status && Object.values(EnquiryStatus).includes(filters.status as EnquiryStatus)) {
    where.status = filters.status as EnquiryStatus;
  }
  if (filters.view === "unassigned") where.lawyerId = null;
  if (filters.view === "escalated") where.escalations = { some: {} };
  if (filters.view === "attention") {
    where.OR = [
      { lawyerId: null },
      { escalations: { some: {} } },
      { status: { in: ["PAYMENT_PENDING"] } },
    ];
  }
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { reference: { contains: s, mode: "insensitive" } },
      { message: { contains: s, mode: "insensitive" } },
      { property: { is: { title: { contains: s, mode: "insensitive" } } } },
      { client: { is: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }

  const [total, enquiries] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where,
      select: {
        id: true,
        reference: true,
        status: true,
        purpose: true,
        submittedAt: true,
        lawyer: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, reference: true, title: true } },
        escalations: { select: { id: true } },
        case: { select: { id: true, reference: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  // Staff-only fields (contact details) are included above on purpose.
  return { enquiries, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}

/** Open the transaction case for an enquiry (case.manage). */
export async function openCase(enquiryId: string, actor: AuthUser, ip?: string) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId } });
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  const existingCase = await prisma.case.findUnique({ where: { enquiryId } });
  if (existingCase) throw ApiError.conflict("A transaction case is already open for this enquiry.");
  if (!enquiry.lawyerId) {
    // No lawyer could be auto-assigned at creation (e.g. none was active).
    // The lawyer opening the case takes it over — otherwise nothing could
    // ever progress, since there is no separate take-up step in the flow.
    if (actor.role !== "LAWYER") {
      throw ApiError.badRequest("Assign a lawyer before opening the case.");
    }
    await prisma.enquiry.update({ where: { id: enquiryId }, data: { lawyerId: actor.id } });
    enquiry.lawyerId = actor.id;
  }

  const property = await prisma.property.findUnique({
    where: { id: enquiry.propertyId },
    select: { providerId: true, reference: true, title: true },
  });
  if (!property) throw ApiError.notFound("Property not found.");

  const result = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx as never, "case");
    const opened = new Date();
    const kase = await tx.case.create({
      data: {
        reference,
        enquiryId: enquiry.id,
        propertyId: enquiry.propertyId,
        clientId: enquiry.clientId,
        providerId: property.providerId,
        lawyerId: enquiry.lawyerId,
        status: enquiry.status,
        openedAt: opened,
      },
    });
    await tx.enquiry.update({
      where: { id: enquiry.id },
      data: { openedAt: opened },
    });
    // Seed the threads: client's opening message + lawyer acknowledgement.
    await tx.caseMessage.createMany({
      data: [
        {
          caseId: kase.id,
          thread: Thread.CLIENT,
          authorId: enquiry.clientId,
          body: enquiry.message,
          at: enquiry.submittedAt,
        },
        {
          caseId: kase.id,
          thread: Thread.INTERNAL,
          authorId: actor.id,
          body: `Enquiry received by the legal team.`,
          at: opened,
        },
      ],
    });
    await tx.caseTimelineEntry.createMany({
      data: [
        {
          caseId: kase.id,
          actorId: enquiry.clientId,
          label: "Enquiry submitted by client.",
          visibility: Visibility.PARTICIPANTS,
          note: "Enquiry submitted.",
          at: enquiry.submittedAt,
        },
        {
          caseId: kase.id,
          actorId: actor.id,
          label: `Transaction case ${reference} opened.`,
          visibility: Visibility.PARTICIPANTS,
          at: opened,
        },
      ],
    });
    return kase;
  });

  await notifyMany([
    { userId: enquiry.clientId, category: "case_update", title: "Transaction case opened", body: `Your enquiry ${enquiry.reference} is now transaction case ${result.reference}.`, link: `/app/client/enquiries/${enquiry.id}` },
    { userId: property.providerId, category: "case_update", title: "Transaction case opened", body: `Transaction case ${result.reference} was opened for ${property.reference} — ${property.title}.`, link: `/app/provider/cases/${result.id}` },
  ]);
  await audit({ actorId: actor.id, action: "case.open", entityType: "Case", entityId: result.id, meta: { reference: result.reference }, ip });
  return result;
}

// ------------------------------------------------------ status updates

const ALL_STATUSES = Object.values(EnquiryStatus);

/** Update case status (case.manage) with a timeline entry + notifications. */
export async function updateStatus(
  caseId: string,
  actor: AuthUser,
  next: EnquiryStatus,
  note?: string,
  ip?: string,
) {
  if (!ALL_STATUSES.includes(next)) throw ApiError.badRequest("Choose a valid status.");
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { enquiry: { select: { id: true, reference: true } } },
  });
  if (!kase) throw ApiError.notFound("Case not found.");
  if (["COMPLETED", "CANCELLED"].includes(kase.status) && next !== kase.status) {
    throw ApiError.badRequest("This case is closed. Cancelled and completed cases cannot be reopened from here.");
  }

  const statusLabel = (s: EnquiryStatus) =>
    s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const closed = next === "COMPLETED" || next === "CANCELLED";

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.case.update({
      where: { id: caseId },
      data: {
        status: next,
        closedAt: closed ? new Date() : null,
        closingNote: closed ? note ?? null : null,
      },
    });
    await tx.enquiry.update({
      where: { id: c.enquiryId },
      data: { status: next },
    });
    await tx.caseTimelineEntry.createMany({
      data: [
        {
          caseId,
          actorId: actor.id,
          label: `Status changed from ${statusLabel(kase.status)} to ${statusLabel(next)}.`,
          visibility: Visibility.INTERNAL,
        },
        {
          caseId,
          actorId: actor.id,
          label: `Status changed from ${statusLabel(kase.status)} to ${statusLabel(next)}.`,
          visibility: Visibility.PARTICIPANTS,
          note: note || defaultClientNote(next),
        },
      ],
    });
    return c;
  });

  await notifyMany([
    { userId: kase.clientId, category: "case_update", title: "Case update", body: note || defaultClientNote(next), link: `/app/client/enquiries/${kase.enquiryId}` },
    { userId: kase.providerId, category: "case_update", title: "Case update", body: `${kase.reference} status: ${statusLabel(next)}.`, link: `/app/provider/cases/${caseId}` },
  ]);
  await audit({ actorId: actor.id, action: "case.status", entityType: "Case", entityId: caseId, meta: { from: kase.status, to: next, note }, ip });
  return updated;
}

function defaultClientNote(next: EnquiryStatus): string {
  switch (next) {
    case "IN_PROGRESS": return "Your enquiry is in progress.";
    case "NEGOTIATION": return "Negotiation and inspection arrangements are under way.";
    case "PAYMENT_PENDING": return "A payment request is waiting for you.";
    case "COMPLETED": return "This transaction is complete. Thank you.";
    case "CANCELLED": return "This enquiry has been cancelled.";
    default: return "Your enquiry has been updated.";
  }
}

// ------------------------------------------------------------ messages

/** Role-scoped thread list. Staff see all threads; participants see theirs. */
export async function getThreads(user: AuthUser, caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, clientId: true, providerId: true, lawyerId: true },
  });
  if (!kase) throw ApiError.notFound("Case not found.");

  const staff = can(user, "case.viewAll");
  const isClient = kase.clientId === user.id;
  const isProvider = kase.providerId === user.id;
  if (!staff && !isClient && !isProvider) throw ApiError.forbidden();

  const threads: Thread[] = staff
    ? [Thread.CLIENT, Thread.PROVIDER, Thread.INTERNAL]
    : isClient
      ? [Thread.CLIENT]
      : [Thread.PROVIDER];

  const messages = await prisma.caseMessage.findMany({
    where: { caseId, thread: { in: threads } },
    orderBy: { at: "asc" },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  return { threads, messages };
}

export async function postMessage(
  user: AuthUser,
  caseId: string,
  thread: Thread,
  body: string,
) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, reference: true, clientId: true, providerId: true, lawyerId: true, status: true, enquiryId: true },
  });
  if (!kase) throw ApiError.notFound("Case not found.");
  if (["COMPLETED", "CANCELLED"].includes(kase.status)) {
    throw ApiError.badRequest("This case is closed.");
  }

  const staff = can(user, "case.viewAll");
  const isClient = kase.clientId === user.id;
  const isProvider = kase.providerId === user.id;
  if (!staff && !isClient && !isProvider) throw ApiError.forbidden();

  // Participants can only post to their own thread; internal is staff-only.
  if (!staff && thread !== (isClient ? Thread.CLIENT : Thread.PROVIDER)) {
    throw ApiError.forbidden();
  }
  if (staff && thread === Thread.INTERNAL && !user) throw ApiError.forbidden();

  const trimmed = body.trim();
  if (!trimmed) throw ApiError.badRequest("Write a message before sending.");
  if (trimmed.length > 4000) throw ApiError.badRequest("Messages are limited to 4000 characters.");

  const message = await prisma.caseMessage.create({
    data: { caseId, thread, authorId: user.id, body: trimmed },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  // Notify the right people, mirroring the prototype behaviour.
  const lawyerName = user.role === "LAWYER" ? user.name : "the legal team";
  if (thread === Thread.CLIENT) {
    await notifyMany([{ userId: kase.clientId, category: "case_update", title: "Reply from your lawyer", body: `New message on ${kase.reference} from ${lawyerName}.`, link: `/app/client/enquiries/${kase.enquiryId}` }]);
  } else if (thread === Thread.PROVIDER) {
    await notifyMany([{ userId: kase.providerId, category: "case_update", title: "Reply from the legal team", body: `New message on ${kase.reference} from ${lawyerName}.`, link: `/app/provider/cases/${kase.id}` }]);
  } else if (!staff) {
    // participant posted into their own thread — notify the lawyer(s)
    if (kase.lawyerId) {
      const label = isClient ? "Reply from the client" : "Reply from the property provider";
      await notifyMany([{ userId: kase.lawyerId, category: "case_update", title: label, body: `${trimmed.slice(0, 90)}${trimmed.length > 90 ? "…" : ""}`, link: `/app/staff/matters/${kase.enquiryId}` }]);
    }
  }
  return message;
}

// ----------------------------------------------------- role-scoped reads

/** Staff case detail by enquiry id (staff matters pages key on enquiry id). */
export async function getCaseForStaff(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: {
      case: {
        include: {
          payments: { orderBy: { createdAt: "desc" } },
        },
      },
      property: {
        select: {
          id: true, reference: true, title: true, listingType: true, price: true,
          area: true, lga: true, state: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
      client: { select: { id: true, name: true, email: true, phone: true } },
      lawyer: { select: { id: true, name: true } },
      escalations: { orderBy: { at: "desc" }, include: { by: { select: { name: true } } } },
    },
  });
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  return enquiry;
}

/** Client enquiry detail (their own only). */
export async function getForClient(clientId: string, enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: {
      case: { include: { payments: { orderBy: { createdAt: "desc" } } } },
      property: {
        select: {
          id: true, reference: true, title: true, listingType: true, price: true,
          area: true, lga: true, state: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
    },
  });
  if (!enquiry || enquiry.clientId !== clientId) throw ApiError.notFound("Enquiry not found.");
  return enquiry;
}

/** Provider case detail (their properties only). */
export async function getForProvider(providerId: string, caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      enquiry: { select: { id: true, reference: true, purpose: true, submittedAt: true } },
      property: {
        select: {
          id: true, reference: true, title: true, listingType: true, price: true,
          area: true, lga: true, state: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
      client: { select: { id: true, name: true, email: true, phone: true } },
      lawyer: { select: { id: true, name: true } },
      payments: { select: { id: true, reference: true, amount: true, status: true, dueDate: true, paidAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!kase || kase.providerId !== providerId) throw ApiError.notFound("Case not found.");

  // The client's contact details reach the provider only once the lawyer has
  // disclosed them (party = the receiving party, matching the disclose
  // endpoint). Without a disclosure the fields are stripped from the payload.
  const disclosed = await prisma.contactDisclosure.findFirst({
    where: { caseId, disclosedTo: providerId, party: "provider" },
    select: { id: true },
  });
  const client = disclosed
    ? kase.client
    : { id: kase.client.id, name: kase.client.name, email: null, phone: null };

  return { ...kase, client };
}

/** Role-scoped timeline for a case. */
export async function getTimeline(user: AuthUser, caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, clientId: true, providerId: true },
  });
  if (!kase) throw ApiError.notFound("Case not found.");
  const staff = can(user, "case.viewAll");
  const participant = kase.clientId === user.id || kase.providerId === user.id;
  if (!staff && !participant) throw ApiError.forbidden();

  return prisma.caseTimelineEntry.findMany({
    where: { caseId, visibility: staff ? undefined : Visibility.PARTICIPANTS },
    orderBy: { at: "desc" },
    include: { actor: { select: { name: true } } },
  });
}

/** Escalate an enquiry (any staff member). */
export async function escalate(enquiryId: string, actor: AuthUser, note: string, ip?: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, reference: true, property: { select: { reference: true, title: true } } },
  });
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  const trimmed = note.trim();
  if (!trimmed) throw ApiError.badRequest("Describe why this enquiry needs attention.");

  await prisma.enquiryEscalation.create({
    data: { enquiryId, byId: actor.id, note: trimmed },
  });
  await notifyAllLawyers([
    {
      category: "admin_alert",
      title: "Escalation on " + enquiry.reference,
      body: `${trimmed} (${enquiry.property.reference} — ${enquiry.property.title}).`,
      link: `/app/staff/matters/${enquiry.id}`,
    },
  ]);
  await audit({ actorId: actor.id, action: "enquiry.escalate", entityType: "Enquiry", entityId: enquiryId, meta: { note: trimmed }, ip });
  return { escalated: true };
}

// ------------------------------------------------------- list helpers

export async function listForClient(clientId: string) {
  return prisma.enquiry.findMany({
    where: { clientId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true, reference: true, status: true, purpose: true, submittedAt: true,
      property: {
        select: {
          id: true, reference: true, title: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
      case: { select: { id: true, reference: true } },
    },
  });
}

export async function listCasesForProvider(providerId: string) {
  return prisma.case.findMany({
    where: { providerId },
    orderBy: { openedAt: "desc" },
    select: {
      id: true, reference: true, status: true, openedAt: true,
      enquiry: { select: { reference: true, purpose: true } },
      property: {
        select: {
          id: true, reference: true, title: true,
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, label: true } },
        },
      },
      client: { select: { name: true } },
    },
  });
}

export async function listCasesForStaff(filters: {
  page: number;
  pageSize: number;
  view?: string;
  status?: string;
  lawyerId?: string; // "me" is resolved by the caller into a concrete id
  search?: string;
}) {
  const where: Prisma.CaseWhereInput = {};
  if (filters.view === "open") where.status = { in: OPEN_STATUSES };
  if (filters.view === "closed") where.status = { in: ["COMPLETED", "CANCELLED"] };
  if (filters.status && Object.values(EnquiryStatus).includes(filters.status as EnquiryStatus)) {
    where.status = filters.status as EnquiryStatus;
  }
  if (filters.lawyerId) where.lawyerId = filters.lawyerId;
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { reference: { contains: s, mode: "insensitive" } },
      { property: { is: { title: { contains: s, mode: "insensitive" } } } },
      { client: { is: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }
  const [total, cases] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where,
      select: {
        id: true, reference: true, status: true, openedAt: true,
        enquiry: { select: { id: true, reference: true, submittedAt: true } },
        property: { select: { reference: true, title: true } },
        client: { select: { id: true, name: true } },
        lawyer: { select: { id: true, name: true } },
      },
      orderBy: [{ openedAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return { cases, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}
