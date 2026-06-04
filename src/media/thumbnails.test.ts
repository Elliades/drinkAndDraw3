import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resetEnvCacheForTests } from "@/lib/env";
import {
  storageKeyFromThumbKey,
  thumbAbsPathFromThumbKey,
  thumbKey,
  thumbPublicUrl,
  thumbPublicUrlFromStorageKey,
} from "./thumb-keys";
import { LocalStorageProvider } from "@/storage/local";

describe("thumb-keys", () => {
  let thumbRoot: string;
  let imageRoot: string;
  let prevThumbDir: string | undefined;
  let prevDatabaseUrl: string | undefined;

  beforeEach(async () => {
    thumbRoot = await mkdtemp(path.join(os.tmpdir(), "dd-thumbs-"));
    imageRoot = await mkdtemp(path.join(os.tmpdir(), "dd-images-"));
    prevThumbDir = process.env.THUMB_CACHE_DIR;
    prevDatabaseUrl = process.env.DATABASE_URL;
    process.env.THUMB_CACHE_DIR = thumbRoot;
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    resetEnvCacheForTests();
  });

  afterEach(async () => {
    if (prevThumbDir === undefined) delete process.env.THUMB_CACHE_DIR;
    else process.env.THUMB_CACHE_DIR = prevThumbDir;
    if (prevDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDatabaseUrl;
    resetEnvCacheForTests();
    await rm(thumbRoot, { recursive: true, force: true });
    await rm(imageRoot, { recursive: true, force: true });
  });

  it("derives stable thumb keys from storage keys", () => {
    expect(thumbKey("Hands/photo.jpg")).toBe("Hands/photo.thumb.webp");
    expect(thumbKey("photo.PNG")).toBe("photo.thumb.webp");
  });

  it("builds public thumb URLs", () => {
    expect(thumbPublicUrlFromStorageKey("a b/c.jpg")).toBe(
      "/api/thumbs/a%20b/c.thumb.webp",
    );
    expect(thumbPublicUrl("x/y.thumb.webp")).toBe("/api/thumbs/x/y.thumb.webp");
  });

  it("resolves storage key from thumb key via storage exists", async () => {
    const storage = new LocalStorageProvider(imageRoot);
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.join(imageRoot, "Hands"), { recursive: true });
    await writeFile(path.join(imageRoot, "Hands", "photo.jpg"), Buffer.from([1]));

    const key = await storageKeyFromThumbKey("Hands/photo.thumb.webp", storage);
    expect(key).toBe("Hands/photo.jpg");
  });

  it("blocks path traversal for thumb abs paths", () => {
    expect(() => thumbAbsPathFromThumbKey("../outside.thumb.webp")).toThrow(/traversal/i);
  });
});
