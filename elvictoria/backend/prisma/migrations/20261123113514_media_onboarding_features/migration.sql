-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "videoBytes" INTEGER,
ADD COLUMN     "videoDurationSec" INTEGER,
ADD COLUMN     "videoKey" TEXT,
ADD COLUMN     "videoMimeType" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "ProviderFeature" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderFeature_providerId_idx" ON "ProviderFeature"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFeature_providerId_name_key" ON "ProviderFeature"("providerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SignupDraft_token_key" ON "SignupDraft"("token");

-- AddForeignKey
ALTER TABLE "ProviderFeature" ADD CONSTRAINT "ProviderFeature_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
