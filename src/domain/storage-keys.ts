/**
 * Helpers for parsing storage keys (the URL-safe relative paths used by `StorageProvider`).
 */

import path from "node:path";
import { normalizeFolderPath } from "./folders";

export function folderPathFromKey(key: string): string {
  const dir = path.posix.dirname(key.replace(/\\/g, "/"));
  if (dir === "." || dir === "/" || dir === "") return "";
  return normalizeFolderPath(dir);
}

export function filenameFromKey(key: string): string {
  return path.posix.basename(key.replace(/\\/g, "/"));
}

export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}
