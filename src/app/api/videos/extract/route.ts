import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  extractFromUrl,
  getExtractErrorStatus,
  toExtractError,
} from "@/lib/extractor";
import {
  MAX_TITLE_LENGTH,
  MAX_AUTHOR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAG_COUNT,
  MAX_TAG_LENGTH,
} from "@/lib/validators/videoInput";

/** 把超限的抓取字段自动截断到表单可接受的范围，避免用户进到 /create 就挂校验 */
function clampForForm(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  return s.length > max ? s.slice(0, max) : s;
}
function clampTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => t?.trim())
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .map((t) => (t.length > MAX_TAG_LENGTH ? t.slice(0, MAX_TAG_LENGTH) : t))
    .slice(0, MAX_TAG_COUNT);
}

export const runtime = "nodejs";

const extractOptionsSchema = z
  .object({
    subtitleLangs: z.array(z.string().trim().min(1)).max(10).optional(),
    allowAutoSubs: z.boolean().optional(),
    timeoutMs: z.number().int().positive().max(120_000).optional(),
  })
  .optional();

const extractRequestSchema = z.object({
  url: z.string().trim().min(1, "请输入视频链接。"),
  options: extractOptionsSchema,
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_URL",
          message: "请求格式不正确，请检查视频链接后重试。",
        },
      },
      { status: 400 }
    );
  }

  const parsedBody = extractRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_URL",
          message: parsedBody.error.issues[0]?.message ?? "请输入正确的视频链接。",
        },
      },
      { status: 400 }
    );
  }

  try {
    // cookies 交由各 extractor 从平台对应的 env 变量（BILIBILI_COOKIES / YOUTUBE_COOKIES）
    // 读取；若调用方显式传入 options.cookies 则优先使用。
    const result = await extractFromUrl(parsedBody.data.url, parsedBody.data.options);

    return NextResponse.json({
      success: true,
      video: {
        title: clampForForm(result.title, MAX_TITLE_LENGTH) ?? result.title,
        author: clampForForm(result.author, MAX_AUTHOR_LENGTH) ?? "",
        description:
          clampForForm(result.description, MAX_DESCRIPTION_LENGTH) ?? "",
        transcript: result.transcript,
        tags: clampTags(result.tags),
        duration: result.duration,
        platform: result.platform,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
      },
      meta: {
        subtitleSource: result.subtitleMeta.source,
        language: result.subtitleMeta.lang,
        isAuto: result.subtitleMeta.isAuto,
        charCount: result.transcript.length,
      },
    });
  } catch (error) {
    const extractError = toExtractError(error);

    // 递归展开 cause 链，找出真正的底层错误
    const chain: Array<{ name?: string; message?: string; stderr?: string; stack?: string }> = [];
    let current: unknown = error;
    while (current) {
      if (current instanceof Error) {
        chain.push({
          name: current.name,
          message: current.message,
          // @ts-expect-error - youtube-dl-exec 错误上挂着 stderr
          stderr: (current.stderr as string | undefined)?.slice(0, 800),
          stack: current.stack?.split("\n").slice(0, 5).join("\n"),
        });
        current = (current as { cause?: unknown }).cause;
      } else {
        chain.push({ message: String(current) });
        break;
      }
      if (chain.length > 5) break; // 防环
    }
    console.error("[videos/extract]", { code: extractError.code, chain });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: extractError.code,
          message: extractError.message,
        },
      },
      { status: getExtractErrorStatus(extractError.code) }
    );
  }
}
