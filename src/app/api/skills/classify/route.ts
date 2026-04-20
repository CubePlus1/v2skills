import { NextRequest, NextResponse } from "next/server";
import { getAIModel, hasAIKey } from "@/lib/ai-client";
import { getCategories } from "@/lib/mock/data";
import {
  categoryIds,
  videoClassificationSchema,
} from "@/lib/validators/videoInput";

export const runtime = "nodejs";

type CategorySuggestion = {
  category: (typeof categoryIds)[number];
  confidence: number;
  reason: string;
};

const splitKeywords = (input: string) =>
  input
    .split(/[、，,。；;：:\s/()（）]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 2);

function fallbackClassify(input: {
  title: string;
  description?: string;
  transcript: string;
}): CategorySuggestion {
  const categories = getCategories();
  const normalizedText = [
    input.title,
    input.description ?? "",
    input.transcript.slice(0, 4000),
  ]
    .join(" ")
    .toLowerCase();

  const scored = categories.map((category) => {
    const keywords = new Set([
      category.id,
      category.name,
      ...splitKeywords(category.description),
      ...category.topTags.map((tag) => tag.toLowerCase()),
    ]);

    let score = 0;
    const matched: string[] = [];

    keywords.forEach((keyword) => {
      if (!keyword || keyword.length < 2) {
        return;
      }

      if (normalizedText.includes(keyword)) {
        score += Math.max(1, Math.min(3, Math.floor(keyword.length / 2)));
        matched.push(keyword);
      }
    });

    return {
      category,
      score,
      matched,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  const best = scored[0];
  const second = scored[1];
  const defaultCategory = categories[categories.length - 1] ?? categories[0];

  if (!best || best.score === 0) {
    return {
      category: defaultCategory.id,
      confidence: 0.55,
      reason: "关键词命中较少，先按通识知识类处理，后续可以手动调整。",
    };
  }

  const confidenceBase =
    second && second.score > 0
      ? best.score / (best.score + second.score)
      : 0.86;
  const confidence = Number(
    Math.min(0.95, Math.max(0.58, confidenceBase)).toFixed(2)
  );
  const reasonKeywords = best.matched.slice(0, 4).join("、");

  return {
    category: best.category.id,
    confidence,
    reason: reasonKeywords
      ? `匹配到关键词：${reasonKeywords}，内容更贴近「${best.category.name}」领域。`
      : `内容整体更贴近「${best.category.name}」领域。`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = videoClassificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "视频信息校验失败",
        },
        { status: 422 }
      );
    }

    const input = parsed.data;

    if (!hasAIKey()) {
      return NextResponse.json(fallbackClassify(input));
    }

    try {
      const { generateObject } = await import("ai");
      const { z } = await import("zod");

      const ClassifySchema = z.object({
        category: z.enum(categoryIds),
        confidence: z.number().min(0).max(1),
        reason: z.string().min(1),
      });

      const categories = getCategories()
        .map(
          (category) =>
            `- ${category.id} / ${category.name}: ${category.description}；关键词：${category.topTags.join("、")}`
        )
        .join("\n");

      const transcriptSnippet = input.transcript.slice(0, 5000);
      const result = await generateObject({
        model: await getAIModel(),
        schema: ClassifySchema,
        prompt: `你是 FavToSkill 的分类助手。请根据视频的标题、简介和字幕，从以下分类中选出最合适的一类，只能选一个：

${categories}

视频标题：${input.title}
视频简介：${input.description ?? "无"}
视频字幕：
${transcriptSnippet}

输出要求：
1. category 必须是给定 id 之一
2. confidence 返回 0 到 1 的小数
3. reason 用中文简洁说明判断依据
4. 如果内容同时涉及多个领域，优先选择最核心的创作/学习场景。`,
      });

      return NextResponse.json(result.object);
    } catch (error) {
      console.error("[Skill Classify AI Error]", error);
      return NextResponse.json(fallbackClassify(input));
    }
  } catch (error) {
    console.error("[Skill Classify Error]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "分类时发生未知错误",
      },
      { status: 500 }
    );
  }
}
