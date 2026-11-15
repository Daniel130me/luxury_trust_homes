-- Move property types from a hardcoded enum to an admin-managed table.
--
-- Order matters: the PropertyType rows are created and seeded FIRST so the
-- enum column can be converted to text with a value-by-value mapping — no
-- listing data is lost and every existing category is humanised to match
-- the seeded type names.

-- CreateTable
CREATE TABLE "PropertyType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyType_name_key" ON "PropertyType"("name");

-- CreateIndex
CREATE INDEX "PropertyType_active_sortOrder_idx" ON "PropertyType"("active", "sortOrder");

-- Seed the taxonomy with the previous enum values, human-readable.
INSERT INTO "PropertyType" ("id", "name", "active", "sortOrder") VALUES
  ('ptype_detached_duplex', 'Detached Duplex', true, 1),
  ('ptype_semi_detached_duplex', 'Semi-Detached Duplex', true, 2),
  ('ptype_apartment', 'Apartment', true, 3),
  ('ptype_terrace', 'Terrace House', true, 4),
  ('ptype_bungalow', 'Bungalow', true, 5),
  ('ptype_land', 'Residential Land', true, 6),
  ('ptype_commercial', 'Commercial Property', true, 7);

-- Convert the enum column to text, mapping each old enum value to its
-- seeded type name (data-preserving — no column drop).
ALTER TABLE "Property" ALTER COLUMN "category" TYPE TEXT USING
  CASE "category"::text
    WHEN 'DETACHED_DUPLEX' THEN 'Detached Duplex'
    WHEN 'SEMI_DETACHED_DUPLEX' THEN 'Semi-Detached Duplex'
    WHEN 'APARTMENT' THEN 'Apartment'
    WHEN 'TERRACE' THEN 'Terrace House'
    WHEN 'BUNGALOW' THEN 'Bungalow'
    WHEN 'LAND' THEN 'Residential Land'
    WHEN 'COMMERCIAL' THEN 'Commercial Property'
  END;

-- DropEnum
DROP TYPE "PropertyCategory";
