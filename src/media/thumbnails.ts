import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getStorage } from "@/storage/create-storage";
import {
  thumbAbsPath,
  thumbAbsPathFromThumbKey,
  thumbKey,
} from "./thumb-keys";

export {
  storageKeyFromThumbKey,
  thumbAbsPath,
  thumbAbsPathFromThumbKey,
  thumbKey,
  thumbPublicUrl,
  thumbPublicUrlFromStorageKey,
} from "./thumb-keys";

/** Max width in pixels for grid thumbnails. */
export const THUMB_MAX_WIDTH = 640;

/** WebP quality for thumbnails (0–100). */
export const THUMB_WEBP_QUALITY = 80;

export async function generateThumbFromBuffer(
  buf: Buffer,
  storageKey: string,
): Promise<{ path: string; body: Buffer }> {
  const out = await sharp(buf)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_WEBP_QUALITY })
    .toBuffer();

  const abs = thumbAbsPath(storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out);
  return { path: abs, body: out };
}

export async function generateThumbFromStorageKey(storageKey: string): Promise<Buffer> {
  const storage = getStorage();
  const obj = await storage.read(storageKey);
  const { body } = await generateThumbFromBuffer(obj.body, storageKey);
  return body;
}

export async function deleteThumb(storageKey: string): Promise<void> {
  const abs = thumbAbsPath(storageKey);
  try {
    await fs.unlink(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export async function deleteThumbByThumbKey(thumbRelKey: string): Promise<void> {
  const abs = thumbAbsPathFromThumbKey(thumbRelKey);
  try {
    await fs.unlink(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Regenerate thumb when missing or older than the source file.
 * Returns true if a new thumb was written.
 */
export async function ensureThumbForStorageKey(
  storageKey: string,
  opts?: { force?: boolean },
): Promise<boolean> {
  const storage = getStorage();
  const head = await storage.head(storageKey);
  if (!head) return false;

  const abs = thumbAbsPath(storageKey);
  if (!opts?.force) {
    try {
      const thumbStat = await fs.stat(abs);
      const sourceTime = head.lastModified?.getTime() ?? 0;
      if (thumbStat.mtimeMs >= sourceTime) return false;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  await generateThumbFromStorageKey(storageKey);
  return true;
}

export async function readThumbFile(thumbRelKey: string): Promise<Buffer | null> {
  const abs = thumbAbsPathFromThumbKey(thumbRelKey);
  try {
    return await fs.readFile(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
