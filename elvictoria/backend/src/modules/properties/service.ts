import { Prisma, Availability, PropertyStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/errors.js";
import { can, type AuthUser } from "../../lib/permissions.js";
import { notifyAllLawyers, notifyMany, audit } from "../../lib/notify.js";
import { nextReference } from "../../lib/references.js";

/**
 * Property service — the heart of the catalogue.
 *
 * Visibility rules (copied from the prototype):
 * - Public: approved + availability != UNAVAILABLE.
 * - Providers: also see their own listings in any status (except that
 *   rejected/pending drafts are managed through the provider area).
 * - Staff (listing.viewAll): everything except provider drafts.
 */

export type ListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  listingType?: "SALE" | "RENT";
  state?: string;
  lga?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  beds?: number;
  region?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  featured?: boolean;
};

const ORDER_BY: Record<string, Prisma.PropertyOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  price_asc: [{ price: "asc" }],
  price_desc: [{ price: "desc" }],
};

function publicWhere(filters: ListFilters): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {
    status: PropertyStatus.APPROVED,
    availability: { not: Availability.UNAVAILABLE },
  };
  if (filters.listingType) where.listingType = filters.listingType;
  if (filters.state) where.state = filters.state;
  if (filters.region) where.region = filters.region;
  if (filters.lga) where.lga = filters.lga;
  if (filters.category) {
    // Types are admin-managed text values now; filter matches the stored name.
    where.category = filters.category;
  }
  if (filters.beds) where.beds = { gte: filters.beds };
  if (filters.priceMin || filters.priceMax) {
    where.price = {
      ...(filters.priceMin ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax ? { lte: filters.priceMax } : {}),
    };
  }
  if (filters.featured) where.featured = true;
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { title: { contains: s, mode: "insensitive" } },
      { area: { contains: s, mode: "insensitive" } },
      { lga: { contains: s, mode: "insensitive" } },
      { state: { contains: s, mode: "insensitive" } },
      { reference: { contains: s, mode: "insensitive" } },
    ];
  }
  return where;
}

const LIST_SELECT = {
  id: true,
  reference: true,
  title: true,
  category: true,
  listingType: true,
  price: true,
  state: true,
  lga: true,
  area: true,
  region: true,
  beds: true,
  baths: true,
  toilets: true,
  sqm: true,
  parking: true,
  furnishing: true,
  availability: true,
  featured: true,
  cautionDeposit: true,
  serviceCharge: true,
  createdAt: true,
  images: {
    orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: { url: true, label: true },
  },
} satisfies Prisma.PropertySelect;

/** Paginated, filtered catalogue over real database records. */
export async function listPublic(filters: ListFilters) {
  const where = publicWhere(filters);
  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      select: LIST_SELECT,
      orderBy: filters.sort
        ? ORDER_BY[filters.sort] ?? ORDER_BY.newest
        : ORDER_BY.newest,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return { properties, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}

export async function listFeatured(limit = 6) {
  return prisma.property.findMany({
    where: { status: PropertyStatus.APPROVED, availability: { not: Availability.UNAVAILABLE }, featured: true },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Full detail by reference (public visibility enforced unless authorised). */
export async function getByReference(reference: string, user: AuthUser | null) {
  const property = await prisma.property.findUnique({
    where: { reference },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      provider: { select: { id: true, name: true, organisation: true } },
    },
  });
  if (!property) throw ApiError.notFound("Property not found.");

  const isOwner = user?.role === "PROVIDER" && property.providerId === user.id;
  const isPublic = property.status === PropertyStatus.APPROVED && property.availability !== Availability.UNAVAILABLE;

  if (!isPublic) {
    const staffSeeAll = can(user, "listing.viewAll");
    if (!staffSeeAll && !isOwner) throw ApiError.notFound("Property not found.");
    // Providers cannot open other providers' non-public listings.
    if (isOwner && !isPublic && !staffSeeAll && property.status === PropertyStatus.REJECTED) {
      // owner may still see it with feedback in their dashboard
    }
  }
  return property;
}

// ------------------------------------------------------------ mutations

export type UpsertInput = {
  title: string;
  category: string;
  listingType: "SALE" | "RENT";
  price: number;
  state: string;
  region?: string;
  lga: string;
  area: string;
  address: string;
  beds?: number;
  baths?: number;
  toilets?: number;
  sqm?: number;
  parking?: number;
  furnishing?: string;
  description: string;
  features?: string[];
  availability?: Availability;
  cautionDeposit?: number;
  serviceCharge?: number;
  submitForReview?: boolean;
};

/**
 * Property types are admin-managed; a submitted category must match an
 * ACTIVE type name exactly. Returns an error message or null when valid.
 */
export async function validatePropertyCategory(category: string): Promise<string | null> {
  const type = await prisma.propertyType.findFirst({
    where: { name: category, active: true },
    select: { id: true },
  });
  return type ? null : "Choose a valid property type.";
}

async function validateInput(input: UpsertInput) {
  const errors: Record<string, string> = {};
  if (input.title.trim().length < 8) errors.title = "Give the property a descriptive title (at least 8 characters).";
  const categoryError = await validatePropertyCategory(input.category);
  if (categoryError) errors.category = categoryError;
  if (!(input.price > 0)) errors.price = "Enter a price greater than zero.";
  if (!input.state) errors.state = "Complete the state, LGA and area.";
  if (!input.lga) errors.lga = "Choose an LGA within the selected state.";
  if (!input.area) errors.area = "Choose an area within the selected LGA.";
  if (!input.address.trim()) errors.address = "Describe the location so the legal team can identify it.";
  if (input.description.trim().length < 60) errors.description = "Write a description of at least 60 characters.";
  if (Object.keys(errors).length) throw ApiError.badRequest("Please check the highlighted fields.", errors);
}

async function allocateReference(tx: Prisma.TransactionClient): Promise<string> {
  return nextReference(tx as never, "property");
}

export async function createByProvider(providerId: string, input: UpsertInput) {
  await validateInput(input);
  const submit = input.submitForReview ?? true;

  const property = await prisma.$transaction(async (tx) => {
    const reference = await allocateReference(tx);
    const created = await tx.property.create({
      data: {
        reference,
        providerId,
        title: input.title.trim(),
        category: input.category,
        listingType: input.listingType,
        price: input.price,
        state: input.state,
        region: input.region || null,
        lga: input.lga,
        area: input.area,
        address: input.address.trim(),
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        toilets: input.toilets ?? null,
        sqm: input.sqm ?? null,
        parking: input.parking ?? null,
        furnishing: input.furnishing || null,
        description: input.description.trim(),
        features: input.features ?? [],
        status: submit ? PropertyStatus.PENDING_REVIEW : PropertyStatus.DRAFT,
        availability: input.availability ?? Availability.AVAILABLE,
        cautionDeposit: input.cautionDeposit ?? null,
        serviceCharge: input.serviceCharge ?? null,
        history: {
          create: {
            action: submit ? "submitted" : "draft_saved",
            actorId: providerId,
          },
        },
      },
    });
    return created;
  });

  if (property.status === PropertyStatus.PENDING_REVIEW) {
    const provider = await prisma.user.findUnique({ where: { id: providerId }, select: { name: true } });
    await notifyAllLawyers([
      {
        category: "property_submission",
        title: "Listing submitted for review",
        body: `${provider?.name ?? "A provider"} submitted ${property.reference} — ${property.title} (${input.category.replace(/_/g, " ").toLowerCase()}).`,
        link: `/app/staff/listings?status=pending_review`,
      },
    ]);
  }
  return property;
}

export async function updateByProvider(
  propertyId: string,
  providerId: string,
  input: UpsertInput,
) {
  await validateInput(input);
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found.");
  if (property.providerId !== providerId) throw ApiError.forbidden();

  const editable =
    property.status === PropertyStatus.DRAFT ||
    property.status === PropertyStatus.CHANGES_REQUESTED ||
    property.status === PropertyStatus.APPROVED ||
    property.status === PropertyStatus.PENDING_REVIEW;
  if (!editable) throw ApiError.forbidden("This listing can no longer be edited.");

  // Submitting (the default) always sends the listing back to the legal
  // team — a fresh draft, a rework after "changes requested", or an edit
  // of an approved listing. submitForReview=false keeps it a draft.
  let nextStatus: PropertyStatus;
  if (input.submitForReview === false) {
    nextStatus = PropertyStatus.DRAFT;
  } else if (property.status === PropertyStatus.PENDING_REVIEW) {
    nextStatus = property.status; // already queued — nothing to change
  } else {
    // DRAFT, CHANGES_REQUESTED and APPROVED all (re)enter the review queue.
    nextStatus = PropertyStatus.PENDING_REVIEW;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.property.update({
      where: { id: propertyId },
      data: {
        title: input.title.trim(),
        category: input.category,
        listingType: input.listingType,
        price: input.price,
        state: input.state,
        region: input.region || null,
        lga: input.lga,
        area: input.area,
        address: input.address.trim(),
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        toilets: input.toilets ?? null,
        sqm: input.sqm ?? null,
        parking: input.parking ?? null,
        furnishing: input.furnishing || null,
        description: input.description.trim(),
        features: input.features ?? [],
        status: nextStatus,
        availability: input.availability ?? property.availability,
        cautionDeposit: input.cautionDeposit ?? null,
        serviceCharge: input.serviceCharge ?? null,
        history: {
          create: {
            action: nextStatus === PropertyStatus.PENDING_REVIEW && property.status !== PropertyStatus.PENDING_REVIEW
              ? "submitted"
              : "updated",
            actorId: providerId,
          },
        },
      },
    });
    if (nextStatus === PropertyStatus.PENDING_REVIEW && property.status !== PropertyStatus.PENDING_REVIEW) {
      const provider = await tx.user.findUnique({ where: { id: providerId }, select: { name: true } });
      await tx.notification.createMany({
        data: (
          await tx.user.findMany({ where: { role: "LAWYER", status: "ACTIVE" }, select: { id: true } })
        ).map((l) => ({
          userId: l.id,
          category: "property_submission",
          title: "Listing submitted for review",
          body: `${provider?.name ?? "A provider"} submitted ${updated.reference} — ${updated.title}.`,
          link: `/app/staff/listings?status=pending_review`,
        })),
      });
    }
    return updated;
  });
}

/** Submit an existing draft (or a rework after "changes requested") for review. */
export async function submitForReview(propertyId: string, providerId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found.");
  if (property.providerId !== providerId) throw ApiError.forbidden();
  if (
    property.status !== PropertyStatus.DRAFT &&
    property.status !== PropertyStatus.CHANGES_REQUESTED
  ) {
    throw ApiError.badRequest(
      "Only draft listings, or listings with requested changes, can be submitted for review.",
    );
  }
  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { status: PropertyStatus.PENDING_REVIEW },
  });
  await prisma.propertyHistory.create({
    data: { propertyId, action: "submitted", actorId: providerId },
  });
  await notifyAllLawyers([
    {
      category: "property_submission",
      title: "Listing submitted for review",
      body: `${updated.reference} — ${updated.title} is waiting for review.`,
      link: `/app/staff/listings?status=pending_review`,
    },
  ]);
  return updated;
}

export type ReviewDecision =
  | { action: "approve"; note?: string }
  | { action: "request_changes"; note: string }
  | { action: "reject"; note: string };

/** Staff moderation — approve, request changes, reject, withdraw. */
export async function reviewByStaff(
  propertyId: string,
  actor: AuthUser,
  decision: ReviewDecision,
  ip?: string,
) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found.");

  let nextStatus: PropertyStatus;
  let action: string;
  if (decision.action === "approve") {
    nextStatus = PropertyStatus.APPROVED;
    action = "approved";
  } else if (decision.action === "request_changes") {
    if (!decision.note?.trim()) throw ApiError.badRequest("Tell the provider what to change.");
    nextStatus = PropertyStatus.CHANGES_REQUESTED;
    action = "changes_requested";
  } else {
    if (!decision.note?.trim()) throw ApiError.badRequest("Give a reason for rejecting this listing.");
    nextStatus = PropertyStatus.REJECTED;
    action = "rejected";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.property.update({
      where: { id: propertyId },
      data: { status: nextStatus, feedback: "note" in decision ? decision.note ?? null : null },
    });
    await tx.propertyHistory.create({
      data: {
        propertyId,
        action,
        actorId: actor.id,
        note: "note" in decision ? decision.note ?? null : null,
      },
    });
    return p;
  });

  await notifyMany([
    {
      userId: property.providerId,
      category: "case_update",
      title:
        decision.action === "approve"
          ? "Listing approved"
          : decision.action === "request_changes"
            ? "Changes requested on your listing"
            : "Listing not approved",
      body:
        decision.action === "approve"
          ? `${property.reference} — ${property.title} is now live.`
          : `${property.reference} — ${property.title}: ${decision.note}`,
      link: `/app/provider/properties/${property.id}`,
    },
  ]);

  await audit({
    actorId: actor.id,
    action: `property.${decision.action}`,
    entityType: "Property",
    entityId: propertyId,
    meta: { reference: property.reference, note: "note" in decision ? decision.note : undefined },
    ip,
  });
  return updated;
}

/** Availability is provider-managed for approved listings (under offer etc.). */
export async function setAvailability(
  propertyId: string,
  providerId: string,
  availability: Availability,
) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found.");
  if (property.providerId !== providerId) throw ApiError.forbidden();
  return prisma.property.update({ where: { id: propertyId }, data: { availability } });
}

// -------------------------------------------------------------- saved

export async function listSaved(userId: string) {
  const rows = await prisma.savedProperty.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    include: {
      property: { select: { ...LIST_SELECT, status: true, availability: true } },
    },
  });
  return rows.map((r) => r.property);
}

export async function saveProperty(userId: string, propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found.");
  await prisma.savedProperty.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  });
  return { saved: true };
}

export async function unsaveProperty(userId: string, propertyId: string) {
  await prisma.savedProperty.deleteMany({ where: { userId, propertyId } });
  return { saved: false };
}

// ------------------------------------------------- staff listing review

export async function listForStaff(filters: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}) {
  const where: Prisma.PropertyWhereInput = {};
  if (filters.status && Object.values(PropertyStatus).includes(filters.status as PropertyStatus)) {
    where.status = filters.status as PropertyStatus;
  } else {
    // Staff listing view excludes provider drafts (as in the prototype).
    where.status = { not: PropertyStatus.DRAFT };
  }
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { title: { contains: s, mode: "insensitive" } },
      { reference: { contains: s, mode: "insensitive" } },
      { area: { contains: s, mode: "insensitive" } },
    ];
  }
  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      select: {
        ...LIST_SELECT,
        status: true,
        provider: { select: { id: true, name: true, organisation: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return { properties, total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) };
}

export async function listForProvider(providerId: string, status?: string) {
  const where: Prisma.PropertyWhereInput = { providerId };
  if (status && Object.values(PropertyStatus).includes(status as PropertyStatus)) {
    where.status = status as PropertyStatus;
  }
  return prisma.property.findMany({
    where,
    select: { ...LIST_SELECT, status: true, feedback: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}
