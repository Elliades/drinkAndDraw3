import fs from "node:fs/promises";
import path from "node:path";
import {
  contentTypeFromKey,
  isImageKey,
  type PutObjectInput,
  type ReadObjectResult,
  type StorageObject,
  type StorageProvider,
} from "./types";

/**
 * Local filesystem storage. Keys map 1:1 to files under `rootDir`.
 *
 * Path traversal is blocked via path.resolve + prefix check.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private resolveSafe(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    const absolute = path.resolve(this.rootDir, normalized);
    if (absolute !== this.rootDir && !absolute.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Path traversal blocked: ${key}`);
    }
    return absolute;
  }

  private toKey(absolutePath: string): string {
    return path.relative(this.rootDir, absolutePath).replace(/\\/g, "/");
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const baseAbs = prefix ? this.resolveSafe(prefix) : this.rootDir;
    let exists = true;
    try {
      const stat = await fs.stat(baseAbs);
      if (!stat.isDirectory()) exists = false;
    } catch {
      exists = false;
    }
    if (!exists) return [];

    const out: StorageObject[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else if (entry.isFile()) {
          const key = this.toKey(abs);
          if (!isImageKey(key)) continue;
          let stat;
          try {
            stat = await fs.stat(abs);
          } catch {
            continue;
          }
          out.push({
            key,
            size: stat.size,
            contentType: contentTypeFromKey(key),
            lastModified: stat.mtime,
          });
        }
      }
    };
    await walk(baseAbs);
    return out;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.resolveSafe(key));
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const abs = this.resolveSafe(key);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) return null;
      return {
        key,
        size: stat.size,
        contentType: contentTypeFromKey(key),
        lastModified: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  async read(key: string): Promise<ReadObjectResult> {
    const abs = this.resolveSafe(key);
    const [body, stat] = await Promise.all([fs.readFile(abs), fs.stat(abs)]);
    return {
      body,
      contentType: contentTypeFromKey(key),
      size: stat.size,
      lastModified: stat.mtime,
    };
  }

  async put(input: PutObjectInput): Promise<void> {
    const abs = this.resolveSafe(input.key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.body);
  }

  async delete(key: string): Promise<void> {
    const abs = this.resolveSafe(key);
    try {
      await fs.unlink(abs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async getUrl(key: string): Promise<string> {
    const encoded = key
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `/api/files/${encoded}`;
  }
}
