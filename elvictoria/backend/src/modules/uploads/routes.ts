import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { ok, ApiError } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildMediaKey,
  mediaPublicUrl,
  putMedia,
  deleteMedia,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
} from "../../lib/media-storage.js";
import { audit } from "../../lib/notify.js";

/**
 * Listing media uploads (photos + optional walkthrough video).
 *
 * Uploads go through this backend (never direct from the browser with
 * bucket keys). Files are validated by type and size, stored under unique
 * keys (local media dir in the sandbox, R2 with real credentials), and
 * their metadata recorded in PostgreSQL so the database and the object
 * store stay consistent.
 *
 * `multer` memory storage keeps the request body capped (see limit below).
 */

/** Video MIME types accepted for the optional walkthrough video. */
const VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Hard request cap for a video (upper bound; the configured admin limit is
 * enforced precisely on the received file below). Keeps memory bounded even
 * if the configured limit is large. */
const MAX_VIDEO_REQUEST_BYTES = 500 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_REQUEST_BYTES), files: 8 },
});

const router = Router();

/**
 * Media limits are admin-managed settings (staff Settings page). Defaults
 * keep behaviour predictable before an admin sets anything: 50 MB and two
 * minutes.
 */
const DEFAULT_VIDEO_MAX_MB = 50;
const DEFAULT_VIDEO_MAX_DURATION_SEC = 120;

async function videoLimits(): Promise<{ maxBytes: number; maxDurationSec: number; maxMb: number }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["videoMaxMb", "videoMaxDurationSec"] } },
  });
  const values = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const maxMb = Number.isFinite(values.get("videoMaxMb")) && values.get("videoMaxMb")! > 0
    ? values.get("videoMaxMb")!
    : DEFAULT_VIDEO_MAX_MB;
  const maxDurationSec = Number.isFinite(values.get("videoMaxDurationSec")) && values.get("videoMaxDurationSec")! > 0
    ? values.get("videoMaxDurationSec")!
    : DEFAULT_VIDEO_MAX_DURATION_SEC;
  return { maxBytes: maxMb * 1024 * 1024, maxDurationSec, maxMb };
}

/** Resolve the property for an upload, enforcing provider ownership. */
async function ownedProperty(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, providerId: true, _count: { select: { images: true } } },
  });
  // Same message for missing and not-owned: never confirm existence to a
  // caller who does not own the listing.
  if (!property || property.providerId !== userId) {
    throw ApiError.notFound("Property not found.");
  }
  return property;
}

// ------------------------------------------------------------ photographs

router.post(
  "/property-image",
  requireAuth,
  upload.array("files", 8),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") {
      throw ApiError.forbidden("Only property providers can upload listing photos.");
    }
    const propertyId = String(req.body.propertyId ?? "");
    if (!propertyId) throw ApiError.badRequest("Choose the listing these photos belong to.");

    const property = await ownedProperty(propertyId, req.user!.id);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw ApiError.badRequest("Add at least one photograph.");

    const existingCount = property._count.images;
    if (existingCount + files.length > 10) {
      throw ApiError.badRequest("A listing can have at most 10 photographs.");
    }

    const created: Array<{ id: string; url: string; label: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = IMAGE_MIME_TYPES[file.mimetype];
      if (!extension) {
        throw ApiError.badRequest(
          "Photos must be JPEG, PNG or WebP images.",
          { files: `${file.originalname}: unsupported type` },
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw ApiError.badRequest("Photos must be 5 MB or smaller.", {
          files: `${file.originalname}: too large`,
        });
      }
      const objectKey = buildMediaKey(propertyId, extension);
      try {
        await putMedia(objectKey, file.buffer, file.mimetype);
      } catch {
        throw new ApiError(502, "STORAGE", "Could not store the photo. Please try again.");
      }
      const isFirst = existingCount === 0 && i === 0;
      const record = await prisma.propertyImage.create({
        data: {
          propertyId,
          objectKey,
          url: mediaPublicUrl(objectKey),
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

router.delete("/property-image/:imageId", requireAuth, async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  const image = await prisma.propertyImage.findUnique({
    where: { id: String(req.params.imageId) },
    include: { property: { select: { providerId: true } } },
  });
  if (!image || image.property.providerId !== req.user!.id) {
    throw ApiError.notFound("Photo not found.");
  }

  // Remove from storage first; the database row disappears only if the
  // object delete succeeded, keeping both stores consistent.
  await deleteMedia(image.objectKey);
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

// ------------------------------------------------------------------ video

const videoMetaSchema = z.object({
  propertyId: z.string().min(1),
  // Client-measured duration (read from the <video> element before upload).
  // NON-STANDARD: this value is client-asserted — probing real duration
  // server-side would need ffprobe, which the runtime does not ship. The
  // server-enforced guarantee is the size limit; duration is a best-effort
  // guard agreed with the browser.
  durationSec: z.coerce.number().int().min(1).max(600),
});

router.post(
  "/property-video",
  requireAuth,
  upload.single("file"),
  validate({ body: videoMetaSchema }),
  async (req, res) => {
    if (req.user!.role !== "PROVIDER") {
      throw ApiError.forbidden("Only property providers can upload listing videos.");
    }
    const { propertyId, durationSec } = req.body as { propertyId: string; durationSec: number };
    await ownedProperty(propertyId, req.user!.id);

    const file = req.file;
    if (!file) throw ApiError.badRequest("Choose a video file to upload.");

    const extension = VIDEO_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw ApiError.badRequest("Videos must be MP4, WebM or QuickTime (.mov) files.");
    }

    const { maxBytes, maxDurationSec, maxMb } = await videoLimits();
    if (file.size > maxBytes) {
      throw ApiError.badRequest(`Videos must be ${maxMb} MB or smaller (set by the admin team).`);
    }
    if (durationSec > maxDurationSec) {
      throw ApiError.badRequest(
        `Videos must be ${maxDurationSec} seconds or shorter (set by the admin team).`,
      );
    }

    const objectKey = buildMediaKey(propertyId, extension);
    try {
      await putMedia(objectKey, file.buffer, file.mimetype);
    } catch {
      throw new ApiError(502, "STORAGE", "Could not store the video. Please try again.");
    }

    // One video per listing: replace any previous one (and delete its object).
    const previous = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { videoKey: true },
    });
    if (previous?.videoKey && previous.videoKey !== objectKey) {
      await deleteMedia(previous.videoKey).catch(() => undefined);
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        videoKey: objectKey,
        videoUrl: mediaPublicUrl(objectKey),
        videoBytes: file.size,
        videoMimeType: file.mimetype,
        videoDurationSec: durationSec,
      },
      select: { videoUrl: true, videoBytes: true, videoDurationSec: true },
    });

    await audit({
      actorId: req.user!.id,
      action: "upload.property_video",
      entityType: "Property",
      entityId: propertyId,
      meta: { bytes: file.size, durationSec },
      ip: req.ip,
    });
    ok(res, { video: updated }, 201);
  },
);

router.delete("/property-video", requireAuth, validate({
  body: z.object({ propertyId: z.string().min(1) }),
}), async (req, res) => {
  if (req.user!.role !== "PROVIDER") throw ApiError.forbidden();
  const { propertyId } = req.body as { propertyId: string };
  await ownedProperty(propertyId, req.user!.id);

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { videoKey: true },
  });
  if (property?.videoKey) {
    await deleteMedia(property.videoKey).catch(() => undefined);
  }
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      videoKey: null,
      videoUrl: null,
      videoBytes: null,
      videoMimeType: null,
      videoDurationSec: null,
    },
  });
  ok(res, { deleted: true });
});

export default router;
