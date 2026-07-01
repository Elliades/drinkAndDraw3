// Load .env.local before Prisma / getEnv.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Import SMPL pose data produced by tools/pose3d/export_glb.py into storage, and
 * set Reference.poseDataKey / poseMeshKey / poseStatus so the web app drives its
 * stick figure + anatomy rig from the precomputed pose.
 *
 * Reads <dir>/manifest.json ([{ id, json, glb?, status, error? }]) plus the
 * <id>.json (and optional <id>.glb) files in <dir>. Idempotent: re-running
 * re-uploads only what's present and updates the DB. Failures (no_person/
 * no_pose/error) are recorded in poseStatus so the manifest exporter won't keep
 * retrying them (unless --retry-failed there).
 *
 * Usage:
 *   npm run pose3d:import -- --dir tools/pose3d/out
 *   npm run pose3d:import -- --dir tools/pose3d/out --prefix pose-data
 */

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { getStorage } from "../src/storage/create-storage";

interface Args {
  dir: string;
  prefix: string;
  meshPrefix: string;
}

interface ManifestEntry {
  id: string;
  json?: string;
  glb?: string;
  status: "ok" | "skipped" | "no_person" | "no_pose" | "error";
  error?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: "tools/pose3d/out",
    prefix: "pose-data",
    meshPrefix: "pose-meshes",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") args.dir = argv[++i] ?? args.dir;
    else if (a === "--prefix") args.prefix = argv[++i] ?? args.prefix;
    else if (a === "--mesh-prefix") args.meshPrefix = argv[++i] ?? args.meshPrefix;
  }
  return args;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storage = getStorage();
  const dir = path.resolve(process.cwd(), args.dir);
  const prefix = args.prefix.replace(/^\/+|\/+$/g, "");
  const meshPrefix = args.meshPrefix.replace(/^\/+|\/+$/g, "");

  const manifestRaw = await fs.readFile(path.join(dir, "manifest.json"), "utf-8");
  const entries = JSON.parse(manifestRaw) as ManifestEntry[];
  logger.info({ count: entries.length, dir }, "pose3d:import start");

  let uploaded = 0;
  let updatedStatus = 0;
  let missing = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      if (entry.status === "ok" || entry.status === "skipped") {
        const jsonName = entry.json ?? `${entry.id}.json`;
        const jsonPath = path.join(dir, jsonName);
        if (!(await fileExists(jsonPath))) {
          missing += 1;
          logger.warn({ id: entry.id, jsonPath }, "pose json missing, skipping");
          continue;
        }
        const data: {
          poseDataKey: string;
          poseStatus: string;
          poseMeshKey?: string;
        } = {
          poseDataKey: `${prefix}/${entry.id}.json`,
          poseStatus: "ready",
        };

        const jsonBody = await fs.readFile(jsonPath);
        await storage.put({
          key: data.poseDataKey,
          body: jsonBody,
          contentType: "application/json",
        });

        // Optional debug mesh.
        if (entry.glb) {
          const glbPath = path.join(dir, entry.glb);
          if (await fileExists(glbPath)) {
            const glbBody = await fs.readFile(glbPath);
            data.poseMeshKey = `${meshPrefix}/${entry.id}.glb`;
            await storage.put({
              key: data.poseMeshKey,
              body: glbBody,
              contentType: "model/gltf-binary",
            });
          }
        }

        await prisma.reference.update({ where: { id: entry.id }, data });
        uploaded += 1;
      } else {
        // Record no_person / no_pose / error so we don't keep reprocessing this.
        const poseStatus =
          entry.status === "no_person" || entry.status === "no_pose"
            ? "no_pose"
            : "failed";
        await prisma.reference.update({
          where: { id: entry.id },
          data: { poseStatus },
        });
        updatedStatus += 1;
      }
    } catch (err) {
      failed += 1;
      logger.warn({ err, id: entry.id }, "pose3d:import entry failed");
    }
  }

  logger.info(
    { uploaded, updatedStatus, missing, failed, total: entries.length },
    "pose3d:import done",
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error(err, "pose3d:import fatal");
  await prisma.$disconnect();
  process.exit(1);
});
