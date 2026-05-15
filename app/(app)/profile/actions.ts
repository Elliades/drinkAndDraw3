"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/auth";
import { requireUser } from "@/auth/guards";
import { prisma } from "@/db/client";

const HandleSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_-]+$/, "Only lowercase letters, digits, dashes and underscores allowed.");

export async function updateHandleAction(formData: FormData) {
  const user = await requireUser();
  const handleRaw = String(formData.get("handle") ?? "").toLowerCase().trim();
  const parsed = HandleSchema.safeParse(handleRaw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid handle");
  }
  const existing = await prisma.user.findUnique({ where: { handle: parsed.data } });
  if (existing && existing.id !== user.id) {
    throw new Error("Handle already taken.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { handle: parsed.data } });
  redirect(`/u/${parsed.data}`);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
