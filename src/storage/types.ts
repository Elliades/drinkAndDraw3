/**
 * Storage provider abstraction.
 *
 * A storage object is keyed by a URL-safe relative path (forward slashes, no leading slash).
 * For local storage this maps to a file under `LOCAL_IMAGE_DIR`. For S3 it maps to an object
 * under `S3_PREFIX`. Callers never branch on driver.
 */

export interface StorageObject {
  /** Storage-relative key (URL-safe path, forward slashes, no leading slash). */
  key: string;
  /** File size in bytes if known. */
  size?: number;
  /** Best-effort MIME guess. */
  contentType?: string;
  /** Last modified time if known. */
  lastModified?: Date;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface ReadObjectResult {
  body: Buffer;
  contentType: string;
  size: number;
  lastModified?: Date;
}

export interface StorageProvider {
  readonly name: "local" | "s3";

  /** List all objects matching a key prefix. */
  list(prefix?: string): Promise<StorageObject[]>;

  /** Test whether a given key exists. */
  exists(key: string): Promise<boolean>;

  /** Read object metadata only. */
  head(key: string): Promise<StorageObject | null>;

  /** Read full object body + metadata. */
  read(key: string): Promise<ReadObjectResult>;

  /** Write an object. */
  put(input: PutObjectInput): Promise<void>;

  /** Delete an object (no-op if missing). */
  delete(key: string): Promise<void>;

  /**
   * Return a URL the browser can fetch for this object.
   *  - local driver: returns "/api/files/<key>"
   *  - s3 driver: returns a presigned URL (or public URL if `S3_PUBLIC_URL` is set)
   */
  getUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string>;
}

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

export function isImageKey(key: string): boolean {
  const idx = key.lastIndexOf(".");
  if (idx < 0) return false;
  return IMAGE_EXTENSIONS.has(key.slice(idx).toLowerCase());
}

export function contentTypeFromKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}
