import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  FEATURE_VECTOR_DIM,
  ORDERED_ANGLE_KEYS,
  buildFeatureVector,
  buildLimbMask,
  defaultStandingPose,
  type LimbGroup,
} from "@/features/pose/lib/pose-features";
import { searchByPose } from "@/services/pose-search";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  embedding: z.array(z.number()).length(FEATURE_VECTOR_DIM).optional(),
  mask: z.array(z.number()).length(FEATURE_VECTOR_DIM).optional(),
  targetAngles: z.record(z.number()).optional(),
  limbs: z.array(z.string()).optional(),
  limbStates: z.record(z.string()).optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(48).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let embedding = parsed.data.embedding;
    let mask = parsed.data.mask;

    if (!embedding && parsed.data.targetAngles) {
      const pose = defaultStandingPose();
      const angles: Record<string, number> = {};
      for (const key of ORDERED_ANGLE_KEYS) {
        const v = parsed.data.targetAngles[key];
        if (v != null) angles[key] = v;
      }
      embedding = [...buildFeatureVector(angles, pose)];
      const limbs = parsed.data.limbs?.length
        ? (parsed.data.limbs as LimbGroup[])
        : undefined;
      mask = [...buildLimbMask(limbs)];
    }

    const results = await searchByPose({
      embedding,
      mask,
      limbStates: parsed.data.limbStates,
      folder: parsed.data.folder,
      tags: parsed.data.tags,
      search: parsed.data.search,
      limit: parsed.data.limit,
    });
    return NextResponse.json({
      results: results.map((r) => ({
        referenceId: r.referenceId,
        score: r.score,
        item: r.item,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
