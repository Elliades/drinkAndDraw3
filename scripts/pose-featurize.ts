import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Derive joint angles, limb states, embeddings, and pose:* tags from stored landmarks.
 *
 * Usage:
 *   npm run pose:featurize
 *   npm run pose:featurize -- --limit 100
 *   npm run pose:featurize -- --force
 */

import { TagKind, Prisma } from "@prisma/client";
import { prisma } from "../src/db/client";
import {
  FEATURE_VERSION,
  featurizePose,
  type LimbStates,
} from "../src/features/pose/lib/pose-features";
import type { Pose, WorldPose } from "../src/features/pose/lib/types";
import { logger } from "../src/lib/logger";

interface CliOptions {
  limit?: number;
  force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--limit") opts.limit = Number.parseInt(argv[++i] ?? "", 10);
    else if (arg === "--force") opts.force = true;
  }
  return opts;
}

async function ensurePoseTag(name: string): Promise<string> {
  const tag = await prisma.tag.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true },
  });
  return tag.id;
}

async function syncPoseTags(referenceId: string, newTags: string[]) {
  const existing = await prisma.referenceTag.findMany({
    where: {
      referenceId,
      kind: TagKind.POSE,
    },
    include: { tag: true },
  });
  const existingNames = new Set(existing.map((t) => t.tag.name));
  const desired = new Set(newTags);

  const toRemove = existing.filter((t) => !desired.has(t.tag.name));
  const toAdd = [...desired].filter((n) => !existingNames.has(n));

  if (toRemove.length > 0) {
    await prisma.referenceTag.deleteMany({
      where: { id: { in: toRemove.map((t) => t.id) } },
    });
  }

  for (const name of toAdd) {
    const tagId = await ensurePoseTag(name);
    await prisma.referenceTag.create({
      data: {
        referenceId,
        tagId,
        kind: TagKind.POSE,
      },
    });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const rows = await prisma.posePrediction.findMany({
    where: {
      NOT: { rawLandmarks2d: { equals: Prisma.JsonNull } },
      ...(opts.force
        ? {}
        : {
            OR: [
              { featureVersion: { not: FEATURE_VERSION } },
              { featureVersion: "" },
            ],
          }),
    },
    take: opts.limit,
    orderBy: { computedAt: "asc" },
  });

  if (rows.length === 0) {
    logger.info("No pose predictions to featurize.");
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const pose = row.rawLandmarks2d as unknown as Pose;
    const worldPose = row.rawWorldLandmarks3d as unknown as WorldPose | null;
    const { angles, limbStates, embedding, tags } = featurizePose(
      pose,
      worldPose ?? undefined,
    );

    await prisma.posePrediction.update({
      where: { id: row.id },
      data: {
        jointAngles: angles,
        limbStates: limbStates as LimbStates,
        embedding: [...embedding],
        featureVersion: FEATURE_VERSION,
      },
    });

    await syncPoseTags(row.referenceId, tags);
    updated += 1;
    if (updated % 100 === 0) logger.info({ updated }, "Featurize progress");
  }

  logger.info({ updated }, "Featurize complete");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${baseUrl}/api/pose/invalidate-cache`, { method: "POST" });
    logger.info("Pose search cache invalidated");
  } catch {
    logger.warn("Could not invalidate pose search cache (dev server may be offline)");
  }
}

main()
  .catch((err) => {
    logger.error({ err }, "pose-featurize failed");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
