import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

/**
 * Cloudflare R2 access through the S3-compatible API.
 *
 * Property photographs are public (delivered through the bucket's public
 * r2.dev base URL). Sensitive files, if added later, must use presigned
 * URLs instead of the public base — see README "Private files".
 */
const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/** MIME types accepted for property photographs. */
export const IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Maximum upload size in bytes (5 MB — covers realistic property photos). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Build a collision-proof object key.
 * Format: properties/{propertyId}/{timestamp}-{random}.{ext}
 */
export function buildImageKey(propertyId: string, extension: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `properties/${propertyId}/${Date.now()}-${rand}.${extension}`;
}

export function publicUrl(objectKey: string): string {
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}
