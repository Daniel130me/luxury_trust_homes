import { Router } from "express";
import multer from "multer";
import { ok, ApiError } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  buildImageKey,
  publicUrl,
  putObject,
  deleteObject,
} from "../../lib/r2.js";
import { audit } from "../../lib/notify.js";

/**
 * Image uploads to Cloudflare R2.
 *
 * Uploads go through this backend (never direct from the browser with
 * bucket keys). Files are validated by type and size, stored under unique
 * keys, and their metadata recorded in PostgreSQL so the database and the
 * object store stay consistent.
 *
 * `multer` memory storage keeps the request body capped (see limit below).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 8 },
});

const router = Router();

router.post(
  "/uploads/property-image",
  requireAuth,
  upload.array("files", 8),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") {
      throw ApiError.forbidden("Only property providers can upload listing photos.");
    }
    const propertyId = String(req.body.propertyId ?? "");
    if (!propertyId) throw ApiError.badRequest("Choose the listing these photos belong to.");

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, providerId: true, _count: { select: { images: true } } },
    });
    if (!property || property.providerId !== req.user!.id) {
      throw ApiError.notFound("Property not found.");
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw ApiError.badRequest("Add at least one photograph.");

    const existingCount = property._count.images;
    if (existingCount + files.length > 10) {
      throw ApiError.badRequest("A listing can have at most 10 photographs.");
    }

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = IMAGE_MIME_TYPES[file.mimetype];
      if (!extension) {
        throw ApiError.badRequest(
          "Photos must be JPEG, PNG or WebP images.",
          { files: `${file.originalname}: unsupported type` },
        );
      }
      const objectKey = buildImageKey(propertyId, extension);
      try {
        await putObject(objectKey, file.buffer, file.mimetype);
      } catch (err) {
        throw new ApiError(502, "STORAGE", "Could not store the photo. Please try again.");
      }
      const isFirst = existingCount === 0 && i === 0;
      const record = await prisma.propertyImage.create({
        data: {
          propertyId,
          objectKey,
          url: publicUrl(objectKey),
          label: String(req.body.label || file.originalname.replace(/\.[a-z0-9]+$/i, "") || "Photo").slice(0, 60),
          sortOrder: existingCount + i,
          isCover: isFirst,
          bytes: file.size,
          mimeType: file.mimetype,
        },
      });
      created.push(record);
    }

    await audit({
      actorId: req.user!.id,
      action: "upload.property_image",
      entityType: "Property",
      entityId: propertyId,
      meta: { count: created.length },
      ip: req.ip,
    });
    ok(res, { images: created }, 201);
  },
);

router.delete("/uploads/property-image/:imageId", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  const image = await prisma.propertyImage.findUnique({
    where: { id: String(req.params.imageId) },
    include: { property: { select: { providerId: true } } },
  });
  if (!image || image.property.providerId !== req.user!.id) {
    throw ApiError.notFound("Photo not found.");
  }

  // Remove from R2 first; the database row disappears only if the object
  // delete succeeded, keeping both stores consistent.
  await deleteObject(image.objectKey);
  await prisma.propertyImage.delete({ where: { id: image.id } });

  // If the cover image was removed, promote the next one.
  const next = await prisma.propertyImage.findFirst({
    where: { propertyId: image.propertyId },
    orderBy: [{ sortOrder: "asc" }],
  });
  if (next && !next.isCover) {
    await prisma.propertyImage.update({ where: { id: next.id }, data: { isCover: true } });
  }
  ok(res, { deleted: true });
});

export default router;
