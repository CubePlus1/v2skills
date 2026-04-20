import { z } from "zod";
import { CATEGORIES } from "@/config/categories";
import type { CategoryId } from "@/types/index";

export const MIN_TRANSCRIPT_LENGTH = 200;
export const MAX_TRANSCRIPT_LENGTH = 10_000;
export const MAX_TAG_COUNT = 10;
export const MAX_TAG_LENGTH = 20;

const EMPTY_TO_UNDEFINED = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
};

export const categoryIds = CATEGORIES.map((category) => category.id) as [
  CategoryId,
  ...CategoryId[],
];

export const categoryIdSchema = z.enum(categoryIds);

export const videoInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请输入视频标题")
    .max(100, "标题最多 100 个字"),
  transcript: z
    .string()
    .trim()
    .min(MIN_TRANSCRIPT_LENGTH, `字幕/文字稿至少 ${MIN_TRANSCRIPT_LENGTH} 字`),
  description: z.preprocess(
    EMPTY_TO_UNDEFINED,
    z.string().max(1000, "简介最多 1000 个字").optional()
  ),
  author: z.preprocess(
    EMPTY_TO_UNDEFINED,
    z.string().max(80, "作者最多 80 个字").optional()
  ),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "标签不能为空")
        .max(MAX_TAG_LENGTH, `每个标签最多 ${MAX_TAG_LENGTH} 个字`)
    )
    .max(MAX_TAG_COUNT, `标签最多 ${MAX_TAG_COUNT} 个`)
    .optional()
    .default([]),
  url: z.preprocess(
    EMPTY_TO_UNDEFINED,
    z.string().url("来源链接格式不正确").optional()
  ),
  duration: z.number().int().positive("时长必须大于 0").optional(),
});

export const inlineVideosSchema = z
  .array(videoInputSchema)
  .min(1, "至少提供 1 个视频");

export const videoClassificationSchema = videoInputSchema.pick({
  title: true,
  description: true,
  transcript: true,
});
