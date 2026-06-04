import path from "node:path";
import { getEnv } from "@/lib/env";
import { getStorage } from "@/storage/create-storage";
import { IMAGE_EXTENSIONS, type StorageProvider } from "@/storage/types";

const THUMB_SUFFIX = ".thumb.webp";

function thumbCacheRoot(): string {
  const env = getEnv();
  const dir = env.THUMB_CACHE_DIR;
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

function resolveSafeThumbKey(thumbKey: string): string {
  const normalized = thumbKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const root = thumbCacheRoot();
  const absolute = path.resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error(`Path traversal blocked: ${thumbKey}`);
  }
  return absolute;
}

/**
 * Derive the cache-relative thumb path from an original storage key.
 * Example: `Hands/photo.jpg` → `Hands/photo.thumb.webp`
 */
export function thumbKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash) : "";
  const filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const thumbName = `${base}${THUMB_SUFFIX}`;
  return dir ? `${dir}/${thumbName}` : thumbName;
}

/** Resolve thumb key back to original storage key by probing known image extensions. */
export async function storageKeyFromThumbKey(
  thumbRelKey: string,
  storage?: StorageProvider,
): Promise<string | null> {
  const normalized = thumbRelKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.endsWith(THUMB_SUFFIX)) return null;
  const withoutSuffix = normalized.slice(0, -THUMB_SUFFIX.length);
  const slash = withoutSuffix.lastIndexOf("/");
  const dir = slash >= 0 ? withoutSuffix.slice(0, slash) : "";
  const base = slash >= 0 ? withoutSuffix.slice(slash + 1) : withoutSuffix;
  const store = storage ?? getStorage();
  for (const ext of IMAGE_EXTENSIONS) {
    const key = dir ? `${dir}/${base}${ext}` : `${base}${ext}`;
    if (await store.exists(key)) return key;
  }
  return null;
}

export function thumbAbsPath(storageKey: string): string {
  return resolveSafeThumbKey(thumbKey(storageKey));
}

export function thumbAbsPathFromThumbKey(thumbRelKey: string): string {
  return resolveSafeThumbKey(thumbRelKey);
}

/** Browser URL for a thumb cache object. */
export function thumbPublicUrl(thumbRelKey: string): string {
  const encoded = thumbRelKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/api/thumbs/${encoded}`;
}

export function thumbPublicUrlFromStorageKey(storageKey: string): string {
  return thumbPublicUrl(thumbKey(storageKey));
}
