"use server";

import { revalidatePath } from "next/cache";
import { TagKind } from "@prisma/client";
import { requireAdmin } from "@/auth/guards";
import {
  addTagToReference,
  bulkTagFolder,
  removeTagFromReference,
} from "@/services/admin-tags";

interface TagFormInput {
  referenceId: string;
  tagName: string;
  kind?: "USER" | "ADMIN";
}

async function readTagInput(formData: FormData): Promise<TagFormInput> {
  return {
    referenceId: String(formData.get("referenceId") ?? ""),
    tagName: String(formData.get("tagName") ?? ""),
    kind: (formData.get("kind") as "USER" | "ADMIN" | null) ?? "USER",
  };
}

export async function addTagAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = await readTagInput(formData);
  if (!input.referenceId || !input.tagName) return;
  await addTagToReference({
    referenceId: input.referenceId,
    tagName: input.tagName,
    kind: input.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER,
    addedById: admin.id,
  });
  revalidatePath("/admin/references");
  revalidatePath(`/library/${input.referenceId}`);
  revalidatePath("/library");
}

export async function removeTagAction(formData: FormData) {
  await requireAdmin();
  const input = await readTagInput(formData);
  if (!input.referenceId || !input.tagName) return;
  await removeTagFromReference({
    referenceId: input.referenceId,
    tagName: input.tagName,
    kind: input.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER,
  });
  revalidatePath("/admin/references");
  revalidatePath(`/library/${input.referenceId}`);
  revalidatePath("/library");
}

export async function bulkTagFolderAction(formData: FormData) {
  const admin = await requireAdmin();
  const folder = String(formData.get("folder") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");
  const action = (formData.get("action") ?? "add") as "add" | "remove";
  const kind = (formData.get("kind") ?? "USER") as "USER" | "ADMIN";
  if (!tagsRaw.trim()) return;

  const tagNames = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await bulkTagFolder({
    folder,
    tagNames,
    kind: kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER,
    action,
    addedById: admin.id,
  });
  revalidatePath("/admin/references");
}
