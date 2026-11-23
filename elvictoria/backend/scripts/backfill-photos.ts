/**
 * Backfill listing photographs for seeded properties.
 *
 * The original seed uploaded photos to Cloudflare R2; with placeholder
 * credentials every upload failed and no PropertyImage rows exist, so all
 * listings render "No photograph yet". This script re-creates the photos
 * through the same storage driver the app now uses (local disk in the
 * sandbox, R2 when real credentials are configured) — see lib/media-storage.
 *
 * Idempotent: properties that already have photos are skipped, so it can run
 * after every environment rebuild. Run: npx tsx scripts/backfill-photos.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { buildMediaKey, mediaPublicUrl, putMedia } from "../src/lib/media-storage.js";

const seedDir = join(process.cwd(), "prisma", "seed-data");

/** Interior photo labels cycled for every listing — same as the seed. */
const VIEW_LABELS: Array<{ label: string; library: keyof typeof photoLibrary | "__main" }> = [
  { label: "Front elevation", library: "__main" },
  { label: "Living room", library: "living" },
  { label: "Kitchen", library: "kitchen" },
  { label: "Bedroom", library: "bedroom" },
];

let photoLibrary: Record<string, string[]> = {};

/** Download one prototype photo and store it. Returns null on failure. */
async function storePhoto(
  propertyId: string,
  photoId: string,
  label: string,
): Promise<{ objectKey: string; url: string } | null> {
  const imageUrl = `https://images.unsplash.com/${photoId}?w=1200&q=75&auto=format&fit=crop`;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const key = buildMediaKey(propertyId, "jpg");
    await putMedia(key, buffer, "image/jpeg");
    return { objectKey: key, url: mediaPublicUrl(key) };
  } catch {
    console.warn(`  photo skipped: ${photoId} (${label})`);
    return null;
  }
}

async function main() {
  photoLibrary = JSON.parse(await readFile(join(seedDir, "photo_library.json"), "utf8"));

  const properties = await prisma.property.findMany({
    select: { id: true, reference: true, category: true, _count: { select: { images: true } } },
    orderBy: { reference: "asc" },
  });
  const missing = properties.filter((p) => p._count.images === 0);
  console.log(`properties: ${properties.length}, without photos: ${missing.length}`);

  let stored = 0;
  for (const property of missing) {
    // Same per-category exterior pick as the seed (protoRef = numeric part).
    const protoRef = Number(property.reference.replace(/^ELV-PR-/, ""));
    const exterior = photoLibrary[property.category] ?? photoLibrary.apartment ?? [];
    const picks = VIEW_LABELS.map((view) => {
      const library = view.library === "__main" ? exterior : photoLibrary[view.library] ?? [];
      const photoId = library.length > 0 ? library[protoRef % library.length] : null;
      return photoId ? { photoId, label: view.label } : null;
    }).filter((v): v is { photoId: string; label: string } => v !== null);

    for (let i = 0; i < picks.length; i++) {
      const stored1 = await storePhoto(property.id, picks[i].photoId, picks[i].label);
      if (!stored1) continue;
      await prisma.propertyImage.create({
        data: {
          propertyId: property.id,
          objectKey: stored1.objectKey,
          url: stored1.url,
          label: picks[i].label,
          sortOrder: i,
          isCover: i === 0,
        },
      });
      stored++;
    }
  }
  console.log(`photos stored: ${stored}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
