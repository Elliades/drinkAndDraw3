import "server-only";
import sharp, { type Metadata } from "sharp";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "@/db/client";
import { getStorage } from "@/storage";
import { normalizeTagList, normalizeTagName } from "@/domain/tags";
import type { Prisma } from "@prisma/client";

export interface DrawingListItem {
  id: string;
  title: string | null;
  filename: string;
  url: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
  tags: string[];
  referenceId: string | null;
  isPublic: boolean;
}

export interface DrawingListResult {
  items: DrawingListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 24;

export async function listDrawings(opts: {
  ownerId?: string;
  publicOnly?: boolean;
  referenceId?: string;
  tags?: readonly string[];
  page?: number;
  pageSize?: number;
}): Promise<DrawingListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.DrawingWhereInput = {};
  if (opts.ownerId) where.ownerId = opts.ownerId;
  if (opts.publicOnly) where.isPublic = true;
  if (opts.referenceId) where.referenceId = opts.referenceId;

  const tags = normalizeTagList(opts.tags ?? []);
  if (tags.length > 0) {
    where.AND = tags.map((t) => ({ tags: { some: { tag: { name: t } } } }));
  }

  const [total, rows] = await Promise.all([
    prisma.drawing.count({ where }),
    prisma.drawing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: { include: { tag: true } } },
    }),
  ]);

  const storage = getStorage();
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      filename: r.filename,
      url: await storage.getUrl(r.storageKey),
      width: r.width,
      height: r.height,
      createdAt: r.createdAt,
      referenceId: r.referenceId,
      isPublic: r.isPublic,
      tags: r.tags.map((t) => t.tag.name),
    })),
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getDrawingById(id: string): Promise<DrawingListItem | null> {
  const row = await prisma.drawing.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!row) return null;
  const storage = getStorage();
  return {
    id: row.id,
    title: row.title,
    filename: row.filename,
    url: await storage.getUrl(row.storageKey),
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    referenceId: row.referenceId,
    isPublic: row.isPublic,
    tags: row.tags.map((t) => t.tag.name),
  };
}

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function createDrawingFromUpload(opts: {
  ownerId: string;
  file: File;
  title?: string;
  referenceId?: string | null;
  isPublic?: boolean;
}): Promise<{ id: string }> {
  if (!ALLOWED_MIME.has(opts.file.type)) {
    throw new Error(`Unsupported file type: ${opts.file.type}`);
  }
  if (opts.file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024}MB).`);
  }

  const buf = Buffer.from(await opts.file.arrayBuffer());
  const meta: Metadata = await sharp(buf)
    .metadata()
    .catch(() => ({}) as Metadata);
  const ext = path.extname(opts.file.name) || mimeToExt(opts.file.type);
  const filename = `${randomUUID()}${ext.toLowerCase()}`;
  const storageKey = `drawings/${opts.ownerId}/${filename}`;

  const storage = getStorage();
  await storage.put({ key: storageKey, body: buf, contentType: opts.file.type });

  const drawing = await prisma.drawing.create({
    data: {
      ownerId: opts.ownerId,
      referenceId: opts.referenceId ?? null,
      storageKey,
      filename,
      title: opts.title?.trim() || null,
      mimeType: opts.file.type,
      width: meta.width ?? null,
      height: meta.height ?? null,
      fileSizeBytes: buf.byteLength,
      isPublic: opts.isPublic ?? true,
    },
    select: { id: true },
  });
  return drawing;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

export async function deleteDrawing(opts: {
  drawingId: string;
  ownerId: string;
}): Promise<{ ok: true }> {
  const row = await prisma.drawing.findUnique({
    where: { id: opts.drawingId },
    select: { storageKey: true, ownerId: true },
  });
  if (!row) return { ok: true };
  if (row.ownerId !== opts.ownerId) throw new Error("forbidden");
  await prisma.drawing.delete({ where: { id: opts.drawingId } });
  const storage = getStorage();
  await storage.delete(row.storageKey).catch(() => undefined);
  return { ok: true };
}

export async function addTagToDrawing(opts: {
  drawingId: string;
  tagName: string;
  addedById: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const owner = await prisma.drawing.findUnique({
    where: { id: opts.drawingId },
    select: { ownerId: true },
  });
  if (!owner) return { ok: false, reason: "Drawing not found" };
  if (owner.ownerId !== opts.addedById) return { ok: false, reason: "forbidden" };
  const name = normalizeTagName(opts.tagName);
  if (!name) return { ok: false, reason: "Invalid tag" };
  const tag = await prisma.tag.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { id: true },
  });
  await prisma.drawingTag.upsert({
    where: { drawingId_tagId: { drawingId: opts.drawingId, tagId: tag.id } },
    update: {},
    create: { drawingId: opts.drawingId, tagId: tag.id, addedById: opts.addedById },
  });
  return { ok: true };
}

export async function removeTagFromDrawing(opts: {
  drawingId: string;
  tagName: string;
  requestedBy: string;
}): Promise<{ ok: true }> {
  const owner = await prisma.drawing.findUnique({
    where: { id: opts.drawingId },
    select: { ownerId: true },
  });
  if (!owner || owner.ownerId !== opts.requestedBy) throw new Error("forbidden");
  const name = normalizeTagName(opts.tagName);
  if (!name) return { ok: true };
  const tag = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
  if (!tag) return { ok: true };
  await prisma.drawingTag.deleteMany({ where: { drawingId: opts.drawingId, tagId: tag.id } });
  return { ok: true };
}
