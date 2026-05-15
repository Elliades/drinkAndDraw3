"use server";

import { revalidatePath } from "next/cache";
import { TagKind } from "@prisma/client";
import { requireAdmin } from "@/auth/guards";
import { prisma } from "@/db/client";
import { addTagToReference, removeTagFromReference } from "@/services/admin-tags";

function revalidateReferencePages(referenceId: string) {
  revalidatePath(`/library/${referenceId}`);
  revalidatePath("/library");
  revalidatePath("/admin/references");
}

export async function updateReferenceDisplayTitleAction(formData: FormData) {
  await requireAdmin();
  const referenceId = String(formData.get("referenceId") ?? "");
  if (!referenceId) return;
  const titleRaw = String(formData.get("title") ?? "").trim();
  const title = titleRaw.length === 0 ? null : titleRaw;
  await prisma.reference.update({
    where: { id: referenceId },
    data: { title },
  });
  revalidateReferencePages(referenceId);
}

interface TagFormInput {
  referenceId: string;
  tagName: string;
  kind: "USER" | "ADMIN";
}

function readTagInput(formData: FormData): TagFormInput {
  return {
    referenceId: String(formData.get("referenceId") ?? ""),
    tagName: String(formData.get("tagName") ?? ""),
    kind: (formData.get("kind") as "USER" | "ADMIN" | null) ?? "USER",
  };
}

export async function addReferenceTagFromLibraryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = readTagInput(formData);
  if (!input.referenceId || !input.tagName) return;
  await addTagToReference({
    referenceId: input.referenceId,
    tagName: input.tagName,
    kind: input.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER,
    addedById: admin.id,
  });
  revalidateReferencePages(input.referenceId);
}

export async function removeReferenceTagFromLibraryAction(formData: FormData) {
  await requireAdmin();
  const input = readTagInput(formData);
  if (!input.referenceId || !input.tagName) return;
  await removeTagFromReference({
    referenceId: input.referenceId,
    tagName: input.tagName,
    kind: input.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER,
  });
  revalidateReferencePages(input.referenceId);
}
