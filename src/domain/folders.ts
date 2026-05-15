/**
 * Folder path normalization.
 *
 * Canonical folder form: forward slashes, no leading/trailing slash, segments trimmed.
 * Empty / root path is the empty string. This keeps prefix matching predictable in SQL:
 *
 *   WHERE folderPath = 'hands' OR folderPath LIKE 'hands/%'
 */

import path from "node:path";

export function normalizeFolderPath(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .join("/");
}

export function parentFolderPath(folder: string): string {
  const norm = normalizeFolderPath(folder);
  if (!norm) return "";
  const idx = norm.lastIndexOf("/");
  if (idx < 0) return "";
  return norm.slice(0, idx);
}

export function folderSegments(folder: string): string[] {
  const norm = normalizeFolderPath(folder);
  if (!norm) return [];
  return norm.split("/");
}

/**
 * Compute the folder path of an image relative to a base directory.
 *
 * Examples (base = "/data"):
 *   "/data/Hands/Closed/x.jpg"  -> "Hands/Closed"
 *   "/data/x.jpg"               -> ""
 */
export function folderPathFromFile(baseDir: string, absoluteFilePath: string): string {
  const normalizedBase = path.resolve(baseDir);
  const normalizedFile = path.resolve(absoluteFilePath);
  const rel = path.relative(normalizedBase, normalizedFile);
  if (rel.startsWith("..")) return "";
  const dir = path.dirname(rel);
  if (dir === "." || dir === "") return "";
  return normalizeFolderPath(dir);
}

/**
 * Build the SQL-friendly filter for "items whose folder is `folder` OR a descendant".
 *
 * Use as: `prisma.reference.findMany({ where: folderPrefixWhere(folder) })`.
 */
export function folderPrefixWhere(folder: string): { OR: Array<{ folderPath: string | { startsWith: string } }> } {
  const norm = normalizeFolderPath(folder);
  if (!norm) {
    return { OR: [{ folderPath: "" }, { folderPath: { startsWith: "" } }] };
  }
  return {
    OR: [{ folderPath: norm }, { folderPath: { startsWith: `${norm}/` } }],
  };
}
