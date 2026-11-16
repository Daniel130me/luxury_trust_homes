import { Router } from "express";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { validate, pageSchema, pageSizeSchema } from "../../middleware/validate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { isStaff } from "../../lib/permissions.js";
import { audit } from "../../lib/notify.js";
import * as svc from "./service.js";

/**
 * Property routes:
 *   GET  /properties            public catalogue (filters, pagination)
 *   GET  /properties/featured   home page selection
 *   GET  /properties/:reference public detail (auth-aware)
 *   POST /provider-properties   provider create
 *   PATCH/POST .../submit       provider edit + submit draft
 *   GET  /provider-properties   provider's own listings
 *   GET  /staff/listings        staff review queue
 *   POST /staff/listings/:id/review   approve / request changes / reject
 *   GET/POST/DELETE /saved      saved properties
 */
const router = Router();

const upsertSchema = z.object({
  title: z.string().trim().min(8).max(140),
  // Property types are admin-managed (see /properties/types); the exact
  // name is validated against active types in the service layer.
  category: z.string().trim().min(1).max(60),
  listingType: z.enum(["SALE", "RENT"]),
  price: z.coerce.number().int().min(1).max(2_000_000_000),
  state: z.string().trim().min(1).max(40),
  region: z.string().trim().max(30).optional().or(z.literal("")),
  lga: z.string().trim().min(1).max(60),
  area: z.string().trim().min(1).max(60),
  address: z.string().trim().min(1).max(500),
  beds: z.coerce.number().int().min(0).max(20).optional().nullable(),
  baths: z.coerce.number().int().min(0).max(20).optional().nullable(),
  toilets: z.coerce.number().int().min(0).max(20).optional().nullable(),
  sqm: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  parking: z.coerce.number().int().min(0).max(50).optional().nullable(),
  furnishing: z.string().trim().max(30).optional().or(z.literal("")),
  description: z.string().trim().min(60).max(5000),
  features: z.array(z.string().trim().max(60)).max(20).optional(),
  availability: z.enum(["AVAILABLE", "UNDER_OFFER", "UNAVAILABLE"]).optional(),
  cautionDeposit: z.coerce.number().int().min(0).max(2_000_000_000).optional().nullable(),
  serviceCharge: z.coerce.number().int().min(0).max(2_000_000_000).optional().nullable(),
  submitForReview: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
  search: z.string().trim().max(80).optional(),
  type: z.enum(["sale", "rent"]).optional(),
  state: z.string().trim().max(40).optional(),
  region: z.string().trim().max(30).optional(),
  lga: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  beds: z.coerce.number().int().min(0).max(10).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
});

function toFilters(q: z.infer<typeof listQuerySchema>) {
  return {
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 12,
    search: q.search || undefined,
    listingType: q.type ? (q.type.toUpperCase() as "SALE" | "RENT") : undefined,
    state: q.state || undefined,
    region: q.region || undefined,
    lga: q.lga || undefined,
    category: q.category,
    priceMin: q.priceMin,
    priceMax: q.priceMax,
    beds: q.beds,
    sort: q.sort,
    featured: q.featured === "true",
  };
}

router.get("/properties", validate({ query: listQuerySchema }), async (req, res) => {
  ok(res, await svc.listPublic(toFilters(req.validated!.query as never)));
});

router.get("/properties/featured", async (_req, res) => {
  ok(res, { properties: await svc.listFeatured() });
});

// ------------------------------------------------------- property types
// Admin-managed taxonomy (replaces the old hardcoded enum). Registered
// before "/properties/:reference" so "types" is not read as a reference.

// Public: active types for the listing form and search filters.
router.get("/properties/types", async (_req, res) => {
  const types = await prisma.propertyType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  ok(res, { types });
});

// Staff: full list including deactivated types (taxonomy management UI).
router.get("/properties/types/all", requirePermission("settings.manage"), async (_req, res) => {
  const types = await prisma.propertyType.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  ok(res, { types });
});

router.post(
  "/properties/types",
  requirePermission("settings.manage"),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(60),
      sortOrder: z.coerce.number().int().min(0).max(999).optional(),
    }),
  }),
  async (req, res) => {
    const name = req.body.name as string;
    // Case-insensitive uniqueness: "apartment" and "Apartment" must not
    // coexist, or the taxonomy and its filters fragment.
    const exists = await prisma.propertyType.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) throw ApiError.badRequest("That property type already exists.", { name: "Already in use (names are case-insensitive)." });
    const max = await prisma.propertyType.aggregate({ _max: { sortOrder: true } });
    const type = await prisma.propertyType.create({
      data: { name, sortOrder: (req.body.sortOrder as number | undefined) ?? (max._max.sortOrder ?? 0) + 1 },
    });
    await audit({ actorId: req.user!.id, action: "property_type.create", entityType: "PropertyType", entityId: type.id, ip: req.ip, meta: { name } });
    ok(res, { type }, 201);
  },
);

router.patch(
  "/properties/types/:id",
  requirePermission("settings.manage"),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(60).optional(),
      active: z.boolean().optional(),
      sortOrder: z.coerce.number().int().min(0).max(999).optional(),
    }),
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const type = await prisma.propertyType.findUnique({ where: { id } });
    if (!type) throw ApiError.notFound("Property type not found.");

    const patch = req.body as { name?: string; active?: boolean; sortOrder?: number };
    // Case-insensitive uniqueness on rename, excluding the type itself so
    // a pure case change ("Terrace House" -> "terrace house") stays allowed.
    if (patch.name && patch.name.toLowerCase() !== type.name.toLowerCase()) {
      const taken = await prisma.propertyType.findFirst({
        where: { name: { equals: patch.name, mode: "insensitive" }, id: { not: id } },
        select: { id: true },
      });
      if (taken) throw ApiError.badRequest("That property type already exists.", { name: "Already in use (names are case-insensitive)." });
    }
    const updated = await prisma.propertyType.update({ where: { id }, data: patch });
    // Deactivating a type hides it from pickers but existing listings keep
    // their value, so no property data needs to change.
    await audit({ actorId: req.user!.id, action: "property_type.update", entityType: "PropertyType", entityId: id, ip: req.ip, meta: patch });
    ok(res, { type: updated });
  },
);

router.get("/properties/:reference", async (req, res) => {
  ok(res, { property: await svc.getByReference(String(req.params.reference), req.user) });
});

// ---------------------------------------------------------- provider area

router.post(
  "/provider/properties",
  requireAuth,
  validate({ body: upsertSchema }),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") throw ApiError.forbidden("Only property providers can list properties.");
    ok(res, { property: await svc.createByProvider(req.user!.id, req.body) }, 201);
  },
);

router.get("/provider/properties", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  const status = String(req.query.status ?? "");
  ok(res, { properties: await svc.listForProvider(req.user!.id, status) });
});

router.get("/provider/properties/:id", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  const property = await prisma.property.findUnique({
    where: { id: String(req.params.id) },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      history: { orderBy: { at: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!property || property.providerId !== req.user!.id) throw ApiError.notFound("Property not found.");
  ok(res, { property });
});

router.patch(
  "/provider/properties/:id",
  requireAuth,
  validate({ body: upsertSchema }),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
    ok(res, { property: await svc.updateByProvider(req.user!.id, String(req.params.id), req.body) });
  },
);

router.post("/provider/properties/:id/submit", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  ok(res, { property: await svc.submitForReview(String(req.params.id), req.user!.id) });
});

router.patch(
  "/provider/properties/:id/availability",
  requireAuth,
  validate({ body: z.object({ availability: z.enum(["AVAILABLE", "UNDER_OFFER", "UNAVAILABLE"]) }) }),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
    ok(res, { property: await svc.setAvailability(req.user!.id, String(req.params.id), req.body.availability) });
  },
);

// ------------------------------------------------------------ staff area

router.get(
  "/staff/listings",
  requirePermission("listing.viewAll"),
  validate({ query: listQuerySchema.extend({ status: z.string().trim().max(30).optional() }) }),
  async (req, res) => {
    const q = req.validated!.query as never as { page?: number; pageSize?: number; status?: string; search?: string };
    ok(res, await svc.listForStaff({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 12,
      status: q.status || undefined,
      search: q.search || undefined,
    }));
  },
);

router.get("/staff/listings/:id", requirePermission("listing.viewAll"), async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: String(req.params.id) },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      provider: { select: { id: true, name: true, email: true, phone: true, organisation: true } },
      history: { orderBy: { at: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!property) throw ApiError.notFound("Property not found.");
  ok(res, { property });
});

router.post(
  "/staff/listings/:id/review",
  requirePermission("listing.moderate"),
  validate({
    body: z.object({
      action: z.enum(["approve", "request_changes", "reject"]),
      note: z.string().trim().max(1000).optional().or(z.literal("")),
    }),
  }),
  async (req, res) => {
    const { action, note } = req.body as { action: "approve" | "request_changes" | "reject"; note?: string };
    ok(res, {
      property: await svc.reviewByStaff(
        String(req.params.id),
        req.user!,
        action === "approve"
          ? { action, note }
          : { action, note: note ?? "" },
        req.ip,
      ),
    });
  },
);

// ------------------------------------------------------------ saved list

router.get("/saved", requireAuth, async (req, res) => {
  ok(res, { properties: await svc.listSaved(req.user!.id) });
});

router.post("/saved", requireAuth, validate({ body: z.object({ propertyId: z.string().min(1) }) }), async (req, res) => {
  ok(res, await svc.saveProperty(req.user!.id, req.body.propertyId));
});

router.delete("/saved/:propertyId", requireAuth, async (req, res) => {
  ok(res, await svc.unsaveProperty(req.user!.id, String(req.params.propertyId)));
});

export default router;

// Staff listing summary used by the dashboard (kept here to avoid cycles).
export async function staffListingsSummary() {
  const statuses = await prisma.property.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const activePublic = await prisma.property.count({
    where: { status: "APPROVED", availability: { not: "UNAVAILABLE" } },
  });
  const summary = {
    total: 0,
    pendingReview: 0,
    approved: 0,
    changesRequested: 0,
    rejected: 0,
    drafts: 0,
    activePublic,
  };
  for (const s of statuses) {
    summary.total += s._count._all;
    if (s.status === "PENDING_REVIEW") summary.pendingReview = s._count._all;
    if (s.status === "APPROVED") summary.approved = s._count._all;
    if (s.status === "CHANGES_REQUESTED") summary.changesRequested = s._count._all;
    if (s.status === "REJECTED") summary.rejected = s._count._all;
    if (s.status === "DRAFT") summary.drafts = s._count._all;
  }
  return summary;
}

export { isStaff };
