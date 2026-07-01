import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  POSE_VOCAB,
  type LimbGroup,
  limbStatesFromFilter,
} from "@/features/pose/lib/pose-features";
import { searchByPose } from "@/services/pose-search";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: z.string().min(1).max(500),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(48).optional(),
});

/** Keyword fallback when no LLM API key is configured. */
function parseQueryFallback(query: string): Record<string, string> {
  const q = query.toLowerCase();
  const states: Record<string, string> = {};

  const setBothArms = (axis: string, value: string) => {
    states[`leftArm.${axis}`] = value;
    states[`rightArm.${axis}`] = value;
  };
  const setBothLegs = (axis: string, value: string) => {
    states[`leftLeg.${axis}`] = value;
    states[`rightLeg.${axis}`] = value;
  };

  if (/\b(arms?\s+up|hands?\s+up|overhead|reach(ing)?\s+up)\b/.test(q)) {
    setBothArms("raise", "overhead");
  } else if (/\b(arms?\s+out|t-?pose|spread)\b/.test(q)) {
    setBothArms("raise", "raised");
  } else if (/\barms?\s+down\b/.test(q)) {
    setBothArms("raise", "down");
  }

  if (/\bleft\s+arm\b/.test(q) && /\bup\b/.test(q)) states["leftArm.raise"] = "overhead";
  if (/\bright\s+arm\b/.test(q) && /\bup\b/.test(q)) states["rightArm.raise"] = "overhead";

  if (/\bsitting\b|\bseated\b/.test(q)) states["archetype.pose"] = "sitting";
  if (/\bstanding\b/.test(q)) states["archetype.pose"] = "standing";
  if (/\blying\b|\breclin/.test(q)) states["archetype.pose"] = "lying";
  if (/\bkneel/.test(q)) states["archetype.pose"] = "kneeling";
  if (/\bcrouch/.test(q)) states["archetype.pose"] = "crouching";
  if (/\bjump/.test(q)) states["archetype.pose"] = "jumping";

  if (/\bhead\s+down\b|\blooking\s+down\b/.test(q)) states["head.nod"] = "down";
  if (/\bhead\s+up\b|\blooking\s+up\b/.test(q)) states["head.nod"] = "up";

  if (/\blean(ing)?\s+forward\b/.test(q)) states["torso.lean"] = "forward";
  if (/\blean(ing)?\s+back\b/.test(q)) states["torso.lean"] = "back";

  if (/\bleft\s+leg\b/.test(q) && /\blift/.test(q)) states["leftLeg.raise"] = "lifted";
  if (/\bright\s+leg\b/.test(q) && /\blift/.test(q)) states["rightLeg.raise"] = "lifted";

  return states;
}

async function parseWithLlm(query: string): Promise<Record<string, string> | null> {
  const apiKey =
    process.env.POSE_LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.POSE_LLM_BASE_URL?.trim() || "https://api.deepseek.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.POSE_LLM_MODEL?.trim() || "deepseek-chat";

  const vocabDesc = Object.entries(POSE_VOCAB)
    .map(([group, axes]) => {
      const axisList = Object.entries(axes)
        .map(([axis, values]) => `${axis}: ${values.join("|")}`)
        .join(", ");
      return `${group}: ${axisList}`;
    })
    .join("\n");

  const system = `You classify human pose search queries into structured limb states.
Vocabulary (group.axis = one of values):
${vocabDesc}

Respond with JSON only: { "limbStates": { "group.axis": "value", ... } }
Use only valid values from the vocabulary. Omit unknown aspects.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as { limbStates?: Record<string, string> };
    return parsed.limbStates ?? null;
  } catch {
    return null;
  }
}

function validateLimbStates(states: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(states)) {
    const dot = key.indexOf(".");
    if (dot === -1) continue;
    const group = key.slice(0, dot) as LimbGroup;
    const axis = key.slice(dot + 1);
    const allowed = POSE_VOCAB[group]?.[axis];
    if (allowed && (allowed as readonly string[]).includes(value)) {
      out[key] = value;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const llmStates = await parseWithLlm(parsed.data.query);
    const fallbackStates = parseQueryFallback(parsed.data.query);
    const merged = validateLimbStates({ ...fallbackStates, ...llmStates });
    const parsedFilter = limbStatesFromFilter(merged);

    const results = await searchByPose({
      limbStates: merged,
      folder: parsed.data.folder,
      tags: parsed.data.tags,
      limit: parsed.data.limit,
    });

    return NextResponse.json({
      query: parsed.data.query,
      parsedFilter: merged,
      parsedStates: parsedFilter,
      source: llmStates ? "llm" : "keyword",
      results: results.map((r) => ({
        referenceId: r.referenceId,
        score: r.score,
        item: r.item,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM search failed" },
      { status: 500 },
    );
  }
}
