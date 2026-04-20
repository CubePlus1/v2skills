// ─────────────────────────────────────────────
// Mock 视频数据加载器（遗留 Demo 流使用）
// 分类体系已迁移到 src/config/categories.ts
// ─────────────────────────────────────────────

import techFavorites from "../../public/mock/tech_favorites.json";
import foodFavorites from "../../public/mock/food_favorites.json";
import knowledgeFavorites from "../../public/mock/knowledge_favorites.json";
import jieshuo from "../../public/mock/jieshuo.json";
import lvyou from "../../public/mock/lvyou.json";
import youxi from "../../public/mock/youxi.json";
import knowledge from "../../public/mock/knowledge.json";
import {
  CATEGORY_NAME_MAP,
  type CategoryId,
  type CategoryMeta,
  getCategories,
  findCategoryId,
} from "@/config/categories";

// 兼容 re-export——迁移期内旧代码仍从本模块取类型/辅助函数
export type { CategoryId, CategoryMeta };
export { getCategories, findCategoryId };

// ─────────────────────────────────────────────
// 视频数据类型（mock-only，真实路径用 src/types/index.ts 里的 VideoInput）
// ─────────────────────────────────────────────

export interface MockVideo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: CategoryId;
  savedAt: string; // ISO 8601
  transcript?: string; // 视频文字稿（用于 RAG）
  // 以下字段源自视频元数据，mock 数据中可能缺失
  author?: string;
  thumbnail?: string;
  url?: string;
  duration?: number; // seconds
  viewCount?: number;
}

// ─────────────────────────────────────────────
// 数据加载（静态导入，构建时打包）
// ─────────────────────────────────────────────

interface RawFavorite {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  savedAt: string;
  transcript?: string;
}

/**
 * 将原始 JSON 数据映射为 MockVideo[]
 */
function mapRawToVideos(
  raw: RawFavorite | RawFavorite[],
  fallbackCategory: CategoryId
): MockVideo[] {
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tags: item.tags,
    category: CATEGORY_NAME_MAP[item.category] ?? fallbackCategory,
    savedAt: item.savedAt,
    transcript: item.transcript,
  }));
}

let _favorites: MockVideo[] | null = null;

/**
 * 加载所有收藏视频（从静态导入的 JSON 合并）。
 */
export function getFavorites(): MockVideo[] {
  if (!_favorites) {
    _favorites = [
      ...mapRawToVideos(techFavorites as RawFavorite[], "tech"),
      ...mapRawToVideos(foodFavorites as RawFavorite[], "food"),
      ...mapRawToVideos(knowledgeFavorites as RawFavorite[], "knowledge"),
      ...mapRawToVideos(jieshuo as RawFavorite[], "jieshuo"),
      ...mapRawToVideos(lvyou as RawFavorite[], "trip"),
      ...mapRawToVideos(youxi as RawFavorite[], "game"),
      ...mapRawToVideos(knowledge as RawFavorite[], "knowledge"),
    ];
  }
  return _favorites;
}

// ─────────────────────────────────────────────
// 查询辅助函数
// ─────────────────────────────────────────────

export function getFavoritesByCategory(category: CategoryId): MockVideo[] {
  return getFavorites().filter((v) => v.category === category);
}

export function getFavoritesPage(
  category?: CategoryId,
  page = 1,
  limit = 10
): { data: MockVideo[]; total: number; page: number; limit: number } {
  let list = getFavorites();
  if (category) list = list.filter((v) => v.category === category);
  const total = list.length;
  const data = list.slice((page - 1) * limit, page * limit);
  return { data, total, page, limit };
}

/**
 * 构建 RAG 上下文字符串。
 * 如果视频有 transcript 则使用 transcript，否则使用 description。
 */
export function buildRagContext(category?: CategoryId): string {
  let list = getFavorites();
  if (category) list = list.filter((v) => v.category === category);

  return list
    .map((v) => {
      const content = v.transcript
        ? v.transcript.slice(0, 600)
        : v.description;
      return `【${v.title}】\n标签：${v.tags.join("、")}\n内容：${content}`;
    })
    .join("\n\n---\n\n");
}
