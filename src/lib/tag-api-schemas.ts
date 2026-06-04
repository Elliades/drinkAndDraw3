import { z } from "zod";

export const SetReferenceTagsBodySchema = z.object({
  tags: z.array(z.string()).default([]),
  kind: z.enum(["USER", "ADMIN"]).optional(),
});

export const AddReferenceTagBodySchema = z.object({
  tag: z.string().min(1),
  kind: z.enum(["USER", "ADMIN"]).optional(),
});

export const NormalizeBodySchema = z.object({
  dryRun: z.boolean().optional(),
});

export const TagKindSchema = z.enum(["USER", "ADMIN"]);
