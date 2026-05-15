"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/guards";
import { createDrawingFromUpload } from "@/services/drawings";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function uploadDrawingAction(formData: FormData) {
  const user = await requireUser();
  enforceRateLimit(`upload:${user.id}`, "upload");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("File is required.");
  }
  const title = String(formData.get("title") ?? "") || undefined;
  const referenceId = formData.get("referenceId");
  const isPublic = formData.get("isPublic") === "on";

  const drawing = await createDrawingFromUpload({
    ownerId: user.id,
    file,
    title,
    referenceId: referenceId ? String(referenceId) : null,
    isPublic,
  });

  revalidatePath("/drawings");
  redirect(`/drawings/${drawing.id}`);
}
