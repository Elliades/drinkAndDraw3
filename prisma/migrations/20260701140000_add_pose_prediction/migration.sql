-- CreateEnum
CREATE TYPE "PoseSource" AS ENUM ('MEDIAPIPE', 'NLF');

-- AlterEnum
ALTER TYPE "TagKind" ADD VALUE 'POSE';

-- CreateTable
CREATE TABLE "PosePrediction" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "source" "PoseSource" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "featureVersion" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION,
    "rawLandmarks2d" JSONB,
    "rawWorldLandmarks3d" JSONB,
    "jointAngles" JSONB NOT NULL DEFAULT '{}',
    "limbStates" JSONB NOT NULL DEFAULT '{}',
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosePrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosePrediction_referenceId_key" ON "PosePrediction"("referenceId");

-- CreateIndex
CREATE INDEX "PosePrediction_source_idx" ON "PosePrediction"("source");

-- CreateIndex
CREATE INDEX "PosePrediction_computedAt_idx" ON "PosePrediction"("computedAt");

-- AddForeignKey
ALTER TABLE "PosePrediction" ADD CONSTRAINT "PosePrediction_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
