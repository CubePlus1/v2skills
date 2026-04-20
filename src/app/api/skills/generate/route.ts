/**
 * app/api/skills/generate/route.ts
 *
 * Skill 生成 API 端点
 * POST /api/skills/generate
 */

import { NextRequest, NextResponse } from "next/server";
import { hasAIKey } from "@/lib/ai-client";
import { getFavorites, MockVideo } from "@/lib/mock/data";
import {
  generateSkillWithAI,
  generateSkillMarkdown,
  validateSkillName,
} from "@/lib/skillTemplate";
import {
  categoryIdSchema,
  inlineVideosSchema,
  MAX_TRANSCRIPT_LENGTH,
} from "@/lib/validators/videoInput";
import {
  GenerateSkillRequest,
  GenerateSkillResponse,
} from "@/types/index";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: GenerateSkillRequest = await req.json();
    const {
      category,
      videoIds,
      videos: inlineVideos,
      skillName,
      skillDescription,
      mode,
    } = body;

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "category 是必填字段",
        } as GenerateSkillResponse,
        { status: 400 }
      );
    }

    const parsedCategory = categoryIdSchema.safeParse(category);

    if (!parsedCategory.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsedCategory.error.issues[0]?.message ??
            "category 是必填字段",
        } as GenerateSkillResponse,
        { status: 400 }
      );
    }
    const safeCategory = parsedCategory.data;

    const mockMode = !hasAIKey();

    // 验证 Skill 名称格式（如果提供）
    if (skillName) {
      const validation = validateSkillName(skillName);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error,
          } as GenerateSkillResponse,
          { status: 400 }
        );
      }
    }

    if (inlineVideos && inlineVideos.length > 0) {
      const parsedVideos = inlineVideosSchema.safeParse(inlineVideos);

      if (!parsedVideos.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              parsedVideos.error.issues[0]?.message ?? "视频输入校验失败",
          } as GenerateSkillResponse,
          { status: 422 }
        );
      }

      let truncated = false;
      const baseId = `user-input-${Date.now()}`;
      const videos: MockVideo[] = parsedVideos.data.map((video, index) => {
        const transcript = video.transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
        if (transcript.length < video.transcript.length) {
          truncated = true;
        }

        return {
          id: `${baseId}-${index}`,
          title: video.title,
          description: video.description ?? "",
          tags: video.tags ?? [],
          category: safeCategory,
          savedAt: new Date().toISOString(),
          transcript,
          author: video.author,
          url: video.url,
          duration: video.duration,
        };
      });

      const skill = await generateSkillWithAI(
        videos,
        safeCategory,
        skillName,
        skillDescription
      );
      const skillContent = generateSkillMarkdown(skill, videos);

      return NextResponse.json({
        success: true,
        skillPath: `.claude/skills/${skill.name}/SKILL.md`,
        skillName: skill.name,
        skillContent,
        skill,
        usageExample: `/${skill.name}`,
        mockMode,
        truncated,
      } as GenerateSkillResponse);
    }

    if (!videoIds || videoIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "videoIds 和 videos 至少提供一种输入",
        } as GenerateSkillResponse,
        { status: 400 }
      );
    }

    // 获取所有视频
    const allVideos = getFavorites();

    // 筛选出指定的视频
    const selectedVideos = allVideos.filter((v) =>
      videoIds.includes(v.id)
    );

    if (selectedVideos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "未找到匹配的视频",
        } as GenerateSkillResponse,
        { status: 404 }
      );
    }

    // 验证视频是否属于指定分类
    const categoryMismatch = selectedVideos.some(
      (v) => v.category !== safeCategory
    );
    if (categoryMismatch) {
      return NextResponse.json(
        {
          success: false,
          error: "部分视频不属于指定分类",
        } as GenerateSkillResponse,
        { status: 400 }
      );
    }

    // 生成 Skill
    const skill = await generateSkillWithAI(
      selectedVideos,
      safeCategory,
      skillName,
      skillDescription
    );

    // 生成 Markdown 内容
    const skillContent = generateSkillMarkdown(skill, selectedVideos);

    // 返回生成内容（serverless 环境不写入文件系统）
    return NextResponse.json({
      success: true,
      skillPath: `.claude/skills/${skill.name}/SKILL.md`,
      skillName: skill.name,
      skillContent,
      skill,
      usageExample: `/${skill.name}`,
      mockMode,
      truncated: false,
    } as GenerateSkillResponse);
  } catch (error) {
    console.error("[Skill Generate Error]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "生成 Skill 时发生未知错误",
      } as GenerateSkillResponse,
      { status: 500 }
    );
  }
}
