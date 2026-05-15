import path from "node:path";
import { getEnv } from "@/lib/env";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

let cached: StorageProvider | null = null;

/**
 * Instantiate the configured storage backend. Safe to call from CLI scripts (`tsx`) and Next.js.
 *
 * Route modules should import `@/storage` (which adds `server-only`) so accidental client bundles fail fast.
 */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.STORAGE_DRIVER === "s3") {
    if (!env.S3_BUCKET) {
      throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    }
    cached = new S3StorageProvider({
      region: env.AWS_REGION,
      bucket: env.S3_BUCKET,
      prefix: env.S3_PREFIX,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      publicUrl: env.S3_PUBLIC_URL,
    });
  } else {
    const dir = path.isAbsolute(env.LOCAL_IMAGE_DIR)
      ? env.LOCAL_IMAGE_DIR
      : path.resolve(process.cwd(), env.LOCAL_IMAGE_DIR);
    cached = new LocalStorageProvider(dir);
  }
  return cached;
}

export function resetStorageCacheForTests(): void {
  cached = null;
}
