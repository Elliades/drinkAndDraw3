import { describe, expect, it } from "vitest";
import {
  folderPathFromFile,
  folderPrefixWhere,
  folderSegments,
  normalizeFolderPath,
  parentFolderPath,
} from "./folders";

describe("normalizeFolderPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeFolderPath("Hands\\Closed")).toBe("Hands/Closed");
  });
  it("strips leading and trailing slashes", () => {
    expect(normalizeFolderPath("/Hands/Closed/")).toBe("Hands/Closed");
  });
  it("collapses empty segments", () => {
    expect(normalizeFolderPath("Hands//Closed///")).toBe("Hands/Closed");
  });
  it("trims segment whitespace", () => {
    expect(normalizeFolderPath(" Hands / Closed ")).toBe("Hands/Closed");
  });
  it("returns empty for root", () => {
    expect(normalizeFolderPath("")).toBe("");
    expect(normalizeFolderPath("/")).toBe("");
    expect(normalizeFolderPath("///")).toBe("");
  });
});

describe("parentFolderPath", () => {
  it("returns parent", () => {
    expect(parentFolderPath("Hands/Closed/Side")).toBe("Hands/Closed");
  });
  it("returns empty for top-level", () => {
    expect(parentFolderPath("Hands")).toBe("");
  });
});

describe("folderSegments", () => {
  it("splits into segments", () => {
    expect(folderSegments("Hands/Closed")).toEqual(["Hands", "Closed"]);
  });
  it("returns [] for root", () => {
    expect(folderSegments("")).toEqual([]);
  });
});

describe("folderPathFromFile", () => {
  it("computes relative folder", () => {
    expect(folderPathFromFile("/data", "/data/Hands/Closed/x.jpg")).toBe("Hands/Closed");
  });
  it("returns empty for files at root", () => {
    expect(folderPathFromFile("/data", "/data/x.jpg")).toBe("");
  });
  it("returns empty when file is outside base", () => {
    expect(folderPathFromFile("/data", "/other/x.jpg")).toBe("");
  });
});

describe("folderPrefixWhere", () => {
  it("matches exact folder and descendants", () => {
    const where = folderPrefixWhere("Hands");
    expect(where.OR).toContainEqual({ folderPath: "Hands" });
    expect(where.OR).toContainEqual({ folderPath: { startsWith: "Hands/" } });
  });
  it("matches all for root", () => {
    const where = folderPrefixWhere("");
    expect(where.OR).toContainEqual({ folderPath: "" });
    expect(where.OR).toContainEqual({ folderPath: { startsWith: "" } });
  });
});
