import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Detect poses for reference images via headless browser + MediaPipe harness.
 *
 * Prerequisites: dev server running at --base-url (default http://localhost:3000).
 *
 * Usage:
 *   npm run dev
 *   npm run pose:detect
 *   npm run pose:detect -- --limit 10
 *   npm run pose:detect -- --force
 *   npm run pose:detect -- --base-url http://localhost:3000
 */

import { chromium } from "@playwright/test";
import { PoseSource, Prisma } from "@prisma/client";
import { prisma } from "../src/db/client";
import { getStorage } from "../src/storage/create-storage";
import { MEDIAPIPE_MODEL_VERSION } from "../src/features/pose/lib/pose-features";
import { logger } from "../src/lib/logger";

interface CliOptions {
  baseUrl: string;
  limit?: number;
  force: boolean;
  since?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { baseUrl: "http://localhost:3000", force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base-url") opts.baseUrl = argv[++i] ?? opts.baseUrl;
    else if (arg === "--limit") opts.limit = Number.parseInt(argv[++i] ?? "", 10);
    else if (arg === "--force") opts.force = true;
    else if (arg === "--since") opts.since = argv[++i];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const storage = getStorage();

  const references = await prisma.reference.findMany({
    where: {
      isPublic: true,
      isApproved: true,
      ...(opts.since ? { updatedAt: { gte: new Date(opts.since) } } : {}),
      ...(opts.force
        ? {}
        : { posePrediction: null }),
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit,
    select: { id: true, storageKey: true },
  });

  if (references.length === 0) {
    logger.info("No references to process.");
    return;
  }

  logger.info({ count: references.length, baseUrl: opts.baseUrl }, "Starting pose detection");

  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors"],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${opts.baseUrl}/internal/pose-harness`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForFunction(() => window.__poseHarnessReady === true, { timeout: 120_000 });

  let ok = 0;
  let failed = 0;
  let noPose = 0;

  for (const ref of references) {
    const path = await storage.getUrl(ref.storageKey);
    const url = path.startsWith("http") ? path : `${opts.baseUrl}${path}`;
    try {
      const result = await page.evaluate(async (imageUrl: string) => {
        if (!window.__detectPoseFromUrl) throw new Error("harness not ready");
        return window.__detectPoseFromUrl(imageUrl);
      }, url);

      if (!result.ok || !result.pose) {
        noPose += 1;
        await prisma.posePrediction.upsert({
          where: { referenceId: ref.id },
          create: {
            referenceId: ref.id,
            source: PoseSource.MEDIAPIPE,
            modelVersion: MEDIAPIPE_MODEL_VERSION,
            confidence: 0,
            rawLandmarks2d: Prisma.JsonNull,
            rawWorldLandmarks3d: Prisma.JsonNull,
          },
          update: {
            source: PoseSource.MEDIAPIPE,
            modelVersion: MEDIAPIPE_MODEL_VERSION,
            confidence: 0,
            rawLandmarks2d: Prisma.JsonNull,
            rawWorldLandmarks3d: Prisma.JsonNull,
          },
        });
        logger.warn({ id: ref.id, error: result.error }, "No pose detected");
        continue;
      }

      const visibilities = result.pose.map((p) => p.visibility ?? 1);
      const confidence =
        visibilities.reduce((a, b) => a + b, 0) / Math.max(1, visibilities.length);

      await prisma.posePrediction.upsert({
        where: { referenceId: ref.id },
        create: {
          referenceId: ref.id,
          source: PoseSource.MEDIAPIPE,
          modelVersion: MEDIAPIPE_MODEL_VERSION,
          confidence,
          rawLandmarks2d: result.pose as unknown as Prisma.InputJsonValue,
          rawWorldLandmarks3d: result.worldPose
            ? (result.worldPose as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        update: {
          source: PoseSource.MEDIAPIPE,
          modelVersion: MEDIAPIPE_MODEL_VERSION,
          confidence,
          rawLandmarks2d: result.pose as unknown as Prisma.InputJsonValue,
          rawWorldLandmarks3d: result.worldPose
            ? (result.worldPose as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
      ok += 1;
      if (ok % 25 === 0) logger.info({ ok, failed, noPose }, "Progress");
    } catch (err) {
      failed += 1;
      logger.error({ err, id: ref.id }, "Detection failed");
    }
  }

  await browser.close();
  logger.info({ ok, failed, noPose, total: references.length }, "Pose detection complete");
}

main()
  .catch((err) => {
    logger.error({ err }, "pose-detect failed");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
