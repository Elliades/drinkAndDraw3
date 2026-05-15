import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalStorageProvider } from "./local";

describe("LocalStorageProvider", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "dd-storage-"));
    storage = new LocalStorageProvider(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("lists only image files recursively", async () => {
    await writeFile(path.join(root, "a.jpg"), Buffer.from([1, 2, 3]));
    await mkdir(path.join(root, "sub"));
    await writeFile(path.join(root, "sub", "b.png"), Buffer.from([4, 5]));
    await writeFile(path.join(root, "sub", "notes.txt"), "hi");

    const all = await storage.list();
    const keys = all.map((o) => o.key).sort();
    expect(keys).toEqual(["a.jpg", "sub/b.png"]);
  });

  it("returns [] when listing a missing directory", async () => {
    const all = await storage.list("does-not-exist");
    expect(all).toEqual([]);
  });

  it("blocks path traversal", async () => {
    await expect(storage.exists("../etc/passwd")).resolves.toBe(false);
    expect(() => storage.getUrl("../etc/passwd")).not.toThrow();
  });

  it("put/exists/read/delete roundtrip", async () => {
    await storage.put({ key: "x/y.jpg", body: Buffer.from("hello"), contentType: "image/jpeg" });
    expect(await storage.exists("x/y.jpg")).toBe(true);

    const head = await storage.head("x/y.jpg");
    expect(head?.size).toBe(5);
    expect(head?.contentType).toBe("image/jpeg");

    const read = await storage.read("x/y.jpg");
    expect(read.body.toString()).toBe("hello");

    await storage.delete("x/y.jpg");
    expect(await storage.exists("x/y.jpg")).toBe(false);
  });

  it("getUrl returns api route with encoded segments", async () => {
    const url = await storage.getUrl("Hands - Mixed/a b.jpg");
    expect(url).toBe("/api/files/Hands%20-%20Mixed/a%20b.jpg");
  });
});
