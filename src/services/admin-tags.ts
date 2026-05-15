import "server-only";
import { prisma } from "@/db/client";
import { normalizeTagName } from "@/domain/tags";
import { TagKind } from "@prisma/client";
import { upsertTagByName } from "@/services/reference-tags-bulk";

export { bulkTagExactFolder, bulkTagFolder } from "@/services/reference-tags-bulk";

export async function addTagToReference(opts: {
  referenceId: string;
  tagName: string;
  kind?: TagKind;
  addedById?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const name = normalizeTagName(opts.tagName);
  if (!name) return { ok: false, reason: "Invalid tag name." };

  const tag = await upsertTagByName(name);
  await prisma.referenceTag.upsert({
    where: {
      referenceId_tagId_kind: {
        referenceId: opts.referenceId,
        tagId: tag.id,
        kind: opts.kind ?? TagKind.USER,
      },
    },
    update: {},
    create: {
      referenceId: opts.referenceId,
      tagId: tag.id,
      kind: opts.kind ?? TagKind.USER,
      addedById: opts.addedById ?? null,
    },
  });
  return { ok: true };
}

export async function removeTagFromReference(opts: {
  referenceId: string;
  tagName: string;
  kind?: TagKind;
}): Promise<{ ok: true }> {
  const name = normalizeTagName(opts.tagName);
  if (!name) return { ok: true };
  const tag = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
  if (!tag) return { ok: true };
  await prisma.referenceTag.deleteMany({
    where: {
      referenceId: opts.referenceId,
      tagId: tag.id,
      kind: opts.kind ?? TagKind.USER,
    },
  });
  return { ok: true };
}
