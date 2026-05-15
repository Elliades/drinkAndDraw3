"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/guards";
import {
  addTagToDrawing,
  deleteDrawing,
  removeTagFromDrawing,
} from "@/services/drawings";

export async function addDrawingTagAction(formData: FormData) {
  const user = await requireUser();
  const drawingId = String(formData.get("drawingId") ?? "");
  const tagName = String(formData.get("tagName") ?? "");
  if (!drawingId || !tagName.trim()) return;
  await addTagToDrawing({ drawingId, tagName, addedById: user.id });
  revalidatePath(`/drawings/${drawingId}`);
}

export async function removeDrawingTagAction(formData: FormData) {
  const user = await requireUser();
  const drawingId = String(formData.get("drawingId") ?? "");
  const tagName = String(formData.get("tagName") ?? "");
  if (!drawingId || !tagName) return;
  await removeTagFromDrawing({ drawingId, tagName, requestedBy: user.id });
  revalidatePath(`/drawings/${drawingId}`);
}

export async function deleteDrawingAction(formData: FormData) {
  const user = await requireUser();
  const drawingId = String(formData.get("drawingId") ?? "");
  if (!drawingId) return;
  await deleteDrawing({ drawingId, ownerId: user.id });
  revalidatePath("/drawings");
  redirect("/drawings");
}
