import { Router, type RequestHandler } from "express";
import multer from "multer";
import { PropertyStatus } from "@prisma/client";
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
import { matchesDeclaredType } from "../../lib/file-signature.js";

/**
 * Listing media uploads (photos + optional walkthrough video).
 *
 * Uploads go through this backend (never direct from the browser with
 * bucket keys). Files are validated by type (declared MIME type AND file
 * signature) and size, stored under unique keys (local media dir in the
 * sandbox, R2 with real credentials), and their metadata recorded in
 * PostgreSQL so the database and the object store stay consistent.
 *
 * `multer` memory storage keeps the request body capped (see limits below).
 */

/** Video MIME types accepted for the optional walkthrough video. */
const VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Hard request cap for a video (upper bound; the configured admin limit is
 * enforced precisely on the received file below). Matches the highest value
 * the settings form accepts (videoMaxMb <= 500). */
const MAX_VIDEO_REQUEST_BYTES = 500 * 1024 * 1024;

/** Photos per upload request, and per listing in total. */
const MAX_PHOTOS_PER_REQUEST = 8;
const MAX_PHOTOS_PER_LISTING = 10;

/** Text fields multer accepts alongside the files (propertyId, label, …). */
const MAX_FORM_FIELDS = 10;

/** Longest photo label stored. */
const MAX_LABEL_LENGTH = 60;

/**
 * Listings in these states can no longer be changed by their provider
 * (mirrors the `editable` rule in the properties service).
 */
const LOCKED_STATUSES: PropertyStatus[] = [
  PropertyStatus.REJECTED,
  PropertyStatus.SUSPENDED,
  PropertyStatus.ARCHIVED,
];

// Separate parsers per media kind: one shared parser sized for videos let
// the photo endpoint buffer 8 x 500 MB in memory for a single request.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_PHOTOS_PER_REQUEST, fields: MAX_FORM_FIELDS },
});
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_REQUEST_BYTES, files: 1, fields: MAX_FORM_FIELDS },
});

/**
 * Translate multer's limit errors into friendly 400 responses (otherwise
 * they surface as generic 500s).
 */
function withUploadErrors(parser: RequestHandler): RequestHandler {
  return (req, res, next) => {
    parser(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "That file is too large."
            : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
              ? `Upload at most ${MAX_PHOTOS_PER_REQUEST} photos, or one video, at a time.`
              : "The upload could not be processed.";
        next(ApiError.badRequest(message));
        return;
      }
      next(err as Error | undefined);
    });
  };
}

const router = Router();

/**
 * Media limits are admin-managed settings (staff Settings page). Defaults
 * keep behaviour predictable before an admin sets anything: 50 MB and two
 * minutes.
 */
const DEFAULT_VIDEO_MAX_MB = 50;
const DEFAULT_VIDEO_MAX_DURATION_SEC = 120;

/** A stored setting as a positive number, or the fallback when unset/invalid. */
function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

async function videoLimits(): Promise<{ maxBytes: number; maxDurationSec: number; maxMb: number }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["videoMaxMb", "videoMaxDurationSec"] } },
  });
  const values = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const maxMb = positiveOr(values.get("videoMaxMb"), DEFAULT_VIDEO_MAX_MB);
  const maxDurationSec = positiveOr(values.get("videoMaxDurationSec"), DEFAULT_VIDEO_MAX_DURATION_SEC);
  return { maxBytes: maxMb * 1024 * 1024, maxDurationSec, maxMb };
}

/**
 * Resolve the property for an upload, enforcing provider ownership and
 * that the listing is still editable.
 */
async function ownedEditableProperty(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, providerId: true, status: true, videoKey: true, _count: { select: { images: true } } },
  });
  // Same message for missing and not-owned: never confirm existence to a
  // caller who does not own the listing.
  if (!property || property.providerId !== userId) {
    throw ApiError.notFound("Property not found.");
  }
  if (LOCKED_STATUSES.includes(property.status)) {
    throw ApiError.forbidden("This listing can no longer be edited.");
  }
  return property;
}

function requireProvider(role: string, message?: string) {
  if (role !== "PROVIDER") throw ApiError.forbidden(message);
}

// ------------------------------------------------------------ photographs

router.post(
  "/property-image",
  requireAuth,
  withUploadErrors(photoUpload.array("files", MAX_PHOTOS_PER_REQUEST)),
  async (req, res) => {
    requireProvider(req.user!.role, "Only property providers can upload listing photos.");
    const propertyId = typeof req.body.propertyId === "string" ? req.body.propertyId : "";
    if (!propertyId) throw ApiError.badRequest("Choose the listing these photos belong to.");

    const property = await ownedEditableProperty(propertyId, req.user!.id);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw ApiError.badRequest("Add at least one photograph.");

    const existingCount = property._count.images;
    if (existingCount + files.length > MAX_PHOTOS_PER_LISTING) {
      throw ApiError.badRequest(`A listing can have at most ${MAX_PHOTOS_PER_LISTING} photographs.`);
    }

    // Validate every file before storing any, so one bad file in the batch
    // never leaves the listing with a partial upload.
    for (const file of files) {
      // The declared MIME type is client-controlled; the file's own magic
      // bytes must agree, so a renamed HTML/SVG file cannot be stored and
      // later served from our origin.
      if (!IMAGE_MIME_TYPES[file.mimetype] || !matchesDeclaredType(file.buffer, file.mimetype)) {
        throw ApiError.badRequest(
          "Photos must be JPEG, PNG or WebP images.",
          { files: `${file.originalname}: unsupported type` },
        );
      }
    }

    const sharedLabel = typeof req.body.label === "string" ? req.body.label.trim() : "";
    const created: Array<{ id: string; url: string; label: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectKey = buildMediaKey(propertyId, IMAGE_MIME_TYPES[file.mimetype]);
      try {
        await putMedia(objectKey, file.buffer, file.mimetype);
      } catch {
        throw new ApiError(502, "STORAGE", "Could not store the photo. Please try again.");
      }
      const fallbackLabel = file.originalname.replace(/\.[a-z0-9]+$/i, "") || "Photo";
      const record = await prisma.propertyImage.create({
        data: {
          propertyId,
          objectKey,
          url: mediaPublicUrl(objectKey),
          label: (sharedLabel || fallbackLabel).slice(0, MAX_LABEL_LENGTH),
          sortOrder: existingCount + i,
          isCover: existingCount === 0 && i === 0,
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
  requireProvider(req.user!.role);
  const image = await prisma.propertyImage.findUnique({
    where: { id: String(req.params.imageId) },
    include: { property: { select: { providerId: true, status: true } } },
  });
  if (!image || image.property.providerId !== req.user!.id) {
    throw ApiError.notFound("Photo not found.");
  }
  if (LOCKED_STATUSES.includes(image.property.status)) {
    throw ApiError.forbidden("This listing can no longer be edited.");
  }

  // Remove from storage first; the database row disappears only if the
  // object delete succeeded, keeping both stores consistent.
  await deleteMedia(image.objectKey);
  await prisma.propertyImage.delete({ where: { id: image.id } });

  // Promote the next photo only when the cover itself was removed —
  // promoting unconditionally gave listings two cover photos.
  // The extra check covers a cover change that landed between reading this
  // photo and deleting it (e.g. a second tab): never create a second cover.
  const coverRemains =
    image.isCover &&
    (await prisma.propertyImage.count({ where: { propertyId: image.propertyId, isCover: true } })) > 0;
  if (image.isCover && !coverRemains) {
    const next = await prisma.propertyImage.findFirst({
      where: { propertyId: image.propertyId },
      orderBy: [{ sortOrder: "asc" }],
    });
    if (next) {
      await prisma.propertyImage.update({ where: { id: next.id }, data: { isCover: true } });
    }
  }
  ok(res, { deleted: true });
});

/**
 * Make one photo the listing's cover. Exactly one cover per listing: the
 * old cover is cleared and the new one set in a single transaction, so a
 * failure never leaves the listing with zero or two covers.
 */
router.patch("/property-image/:imageId/cover", requireAuth, async (req, res) => {
  requireProvider(req.user!.role);
  const image = await prisma.propertyImage.findUnique({
    where: { id: String(req.params.imageId) },
    include: { property: { select: { providerId: true, status: true } } },
  });
  if (!image || image.property.providerId !== req.user!.id) {
    throw ApiError.notFound("Photo not found.");
  }
  if (LOCKED_STATUSES.includes(image.property.status)) {
    throw ApiError.forbidden("This listing can no longer be edited.");
  }

  if (!image.isCover) {
    await prisma.$transaction([
      prisma.propertyImage.updateMany({
        where: { propertyId: image.propertyId, isCover: true },
        data: { isCover: false },
      }),
      prisma.propertyImage.update({ where: { id: image.id }, data: { isCover: true } }),
    ]);
  }
  ok(res, { coverId: image.id });
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
  withUploadErrors(videoUpload.single("file")),
  validate({ body: videoMetaSchema }),
  async (req, res) => {
    requireProvider(req.user!.role, "Only property providers can upload listing videos.");
    const { propertyId, durationSec } = req.body as { propertyId: string; durationSec: number };
    const property = await ownedEditableProperty(propertyId, req.user!.id);

    const file = req.file;
    if (!file) throw ApiError.badRequest("Choose a video file to upload.");

    const extension = VIDEO_MIME_TYPES[file.mimetype];
    if (!extension || !matchesDeclaredType(file.buffer, file.mimetype)) {
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

    // One video per listing: the previous object is removed only after the
    // database points at the new one, so a failed update never leaves the
    // listing referencing a deleted file.
    if (property.videoKey && property.videoKey !== objectKey) {
      await deleteMedia(property.videoKey).catch(() => undefined);
    }

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
  requireProvider(req.user!.role);
  const { propertyId } = req.body as { propertyId: string };
  const property = await ownedEditableProperty(propertyId, req.user!.id);

  if (property.videoKey) {
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
