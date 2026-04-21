/**
 * Skill 名称工具——纯字符串处理，没有任何服务端依赖。
 *
 * 单独成文件是为了让 client（/create 表单校验）和 server（API 路由）
 * 都能直接静态 import，不会把整个 skillTemplate.ts（含 ai SDK 依赖）
 * 拖到客户端 chunk 里。
 */

import type { CategoryId } from "@/config/categories";

export function generateSkillName(
  category: CategoryId,
  mainTag?: string
): string {
  const categorySlug = category
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "");

  const tagSlug = mainTag
    ? mainTag
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    : "";

  const base = tagSlug ? `${categorySlug}-${tagSlug}` : categorySlug;
  return `${base}-skill`;
}

export function validateSkillName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Skill 名称不能为空" };
  }

  if (!/^[a-z0-9\u4e00-\u9fa5]+(-[a-z0-9\u4e00-\u9fa5]+)*$/.test(name)) {
    return {
      valid: false,
      error:
        "Skill 名称必须使用 kebab-case 格式（小写字母、数字、中文，用连字符分隔）",
    };
  }

  return { valid: true };
}
